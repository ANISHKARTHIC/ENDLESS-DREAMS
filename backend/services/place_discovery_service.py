"""AI-powered place discovery service.

When a destination city has no seeded places in the database,
this service uses Mapbox Geocoding + LLM to dynamically discover
and create Place records.
"""
import json
import logging
import random
from datetime import time as dt_time
from decimal import Decimal
from typing import List, Dict, Any, Optional

from django.db import transaction

logger = logging.getLogger('ai_engine')

# Categories and search queries for discovering POIs
DISCOVERY_QUERIES = [
    ('landmark', ['famous landmark', 'monument', 'iconic building', 'historic site']),
    ('culture', ['museum', 'art gallery', 'cultural center', 'temple', 'cathedral', 'mosque']),
    ('nature', ['park', 'garden', 'beach', 'lake', 'nature reserve', 'viewpoint']),
    ('food', ['restaurant', 'food market', 'local cuisine', 'street food', 'cafe']),
    ('adventure', ['adventure', 'hiking trail', 'sports center', 'water sports']),
    ('relaxation', ['spa', 'wellness', 'botanical garden', 'resort']),
    ('shopping', ['shopping mall', 'local market', 'bazaar', 'souvenir shop']),
    ('nightlife', ['bar', 'nightclub', 'rooftop lounge', 'entertainment']),
]

# Reasonable defaults for estimated costs and durations by category
CATEGORY_DEFAULTS = {
    'landmark': {'cost_range': (0, 30), 'duration_range': (60, 120), 'outdoor': True},
    'culture': {'cost_range': (5, 40), 'duration_range': (90, 180), 'outdoor': False},
    'nature': {'cost_range': (0, 15), 'duration_range': (60, 180), 'outdoor': True},
    'food': {'cost_range': (10, 50), 'duration_range': (60, 120), 'outdoor': False},
    'adventure': {'cost_range': (20, 80), 'duration_range': (120, 240), 'outdoor': True},
    'relaxation': {'cost_range': (15, 60), 'duration_range': (90, 180), 'outdoor': False},
    'shopping': {'cost_range': (0, 20), 'duration_range': (60, 120), 'outdoor': False},
    'nightlife': {'cost_range': (15, 60), 'duration_range': (90, 180), 'outdoor': False},
}


class PlaceDiscoveryService:
    """Discover and create Place records for cities with no seeded data."""

    def __init__(self):
        self.mapbox = None
        self.llm = None

    def _get_mapbox(self):
        if not self.mapbox:
            from services.mapbox_places_service import MapboxPlacesService
            self.mapbox = MapboxPlacesService()
        return self.mapbox

    def _get_llm(self):
        if not self.llm:
            from ai_engine.llm_layer import LLMLayer
            self.llm = LLMLayer()
        return self.llm

    def discover_places(self, city: str, country: str, lat: Optional[float] = None,
                        lng: Optional[float] = None, max_places: int = 30) -> List:
        """Discover places for a city using Mapbox + AI enrichment.

        Returns list of created Place model instances.
        """
        from places.models import Place

        mapbox = self._get_mapbox()
        if not mapbox.token:
            logger.warning('No Mapbox token — using LLM-only discovery')
            return self._llm_only_discovery(city, country, max_places)

        # Step 1: Get city coordinates if not provided
        if lat is None or lng is None:
            city_results = mapbox.geocode(f'{city}, {country}', types='place', limit=1)
            if city_results:
                lat = city_results[0]['latitude']
                lng = city_results[0]['longitude']
            else:
                logger.error(f'Could not geocode city: {city}, {country}')
                return self._llm_only_discovery(city, country, max_places)

        # Step 2: Create bounding box (~20km radius)
        delta = 0.18  # ~20km
        bbox = (lng - delta, lat - delta, lng + delta, lat + delta)

        # Step 3: Search Mapbox for POIs in various categories
        discovered = []
        seen_names = set()

        for category, queries in DISCOVERY_QUERIES:
            places_needed = max(2, max_places // len(DISCOVERY_QUERIES))
            for query_text in queries:
                if len([d for d in discovered if d['category'] == category]) >= places_needed:
                    break
                search_query = f'{query_text} in {city}'
                results = mapbox.search_pois(search_query, bbox, limit=5)
                for r in results:
                    name = r.get('name', '').strip()
                    if not name or name.lower() in seen_names:
                        continue
                    if len(name) < 3:
                        continue
                    seen_names.add(name.lower())
                    discovered.append({
                        'name': name,
                        'category': category,
                        'latitude': r['latitude'],
                        'longitude': r['longitude'],
                        'address': r.get('full_address', ''),
                        'mapbox_id': r.get('mapbox_id', ''),
                    })

        if not discovered:
            logger.warning(f'Mapbox returned no POIs for {city} — using LLM fallback')
            return self._llm_only_discovery(city, country, max_places)

        # Step 4: Enrich with AI (batch approach)
        enriched = self._enrich_with_llm(discovered[:max_places], city, country)

        # Step 5: Create Place records
        created_places = self._create_place_records(enriched, city, country)
        logger.info(f'Discovered {len(created_places)} places for {city} via Mapbox + AI')
        return created_places

    def _enrich_with_llm(self, places: List[Dict], city: str, country: str) -> List[Dict]:
        """Use LLM to generate descriptions, ratings, costs, durations."""
        llm = self._get_llm()

        # Build a batch prompt for efficiency
        place_names = [f"- {p['name']} ({p['category']})" for p in places]
        names_text = '\n'.join(place_names[:20])  # Limit to 20 at a time

        system_prompt = """You are a travel data enrichment AI. Given a list of places in a city, 
generate realistic travel data for each. Return ONLY a valid JSON array.
Each item must have: name, description (1 sentence, informative), rating (1.0-5.0), 
avg_cost_usd (number), avg_duration_minutes (number), opening_hours (like "08:00-18:00"), 
is_outdoor (boolean). Be realistic with costs and durations based on the location."""

        user_prompt = f"""City: {city}, {country}
Places to enrich:
{names_text}

Return JSON array with enrichment data for each place."""

        try:
            response = llm._call_llm(system_prompt, user_prompt, max_tokens=1500)
            # Parse LLM response
            # Find JSON array in response
            start = response.find('[')
            end = response.rfind(']') + 1
            if start >= 0 and end > start:
                enrichments = json.loads(response[start:end])
                # Merge enrichments into places
                enrich_map = {e.get('name', '').lower(): e for e in enrichments}
                for p in places:
                    enrichment = enrich_map.get(p['name'].lower(), {})
                    p['description'] = enrichment.get('description', f'A popular {p["category"]} destination in {city}')
                    p['rating'] = max(1.0, min(5.0, float(enrichment.get('rating', random.uniform(3.5, 4.5)))))
                    p['avg_cost_usd'] = float(enrichment.get('avg_cost_usd', self._default_cost(p['category'])))
                    p['avg_duration_minutes'] = int(enrichment.get('avg_duration_minutes', self._default_duration(p['category'])))
                    p['opening_hours'] = enrichment.get('opening_hours', '08:00-20:00')
                    p['is_outdoor'] = enrichment.get('is_outdoor', CATEGORY_DEFAULTS.get(p['category'], {}).get('outdoor', False))
                return places
        except Exception as e:
            logger.warning(f'LLM enrichment failed: {e}')

        # Fallback: use category defaults
        for p in places:
            p['description'] = f'A popular {p["category"]} destination in {city}'
            p['rating'] = round(random.uniform(3.5, 4.8), 1)
            p['avg_cost_usd'] = self._default_cost(p['category'])
            p['avg_duration_minutes'] = self._default_duration(p['category'])
            p['opening_hours'] = '08:00-20:00'
            p['is_outdoor'] = CATEGORY_DEFAULTS.get(p['category'], {}).get('outdoor', False)

        return places

    def _llm_only_discovery(self, city: str, country: str, max_places: int) -> List:
        """Fallback: use LLM to generate place data when Mapbox is unavailable."""
        from places.models import Place

        llm = self._get_llm()

        system_prompt = """You are a travel expert AI. Generate a list of real, well-known places to visit in a city.
Return ONLY a valid JSON array. Each item must have:
name, category (one of: culture, nature, food, adventure, relaxation, shopping, nightlife, landmark),
description (1 sentence), rating (1.0-5.0), avg_cost_usd (number), avg_duration_minutes (number),
latitude (float), longitude (float), opening_hours (like "08:00-18:00"), is_outdoor (boolean).
Use REAL place names and ACCURATE coordinates. Be specific and realistic."""

        user_prompt = f"""Generate {min(max_places, 20)} must-visit places in {city}, {country}.
Include a mix of landmarks, cultural sites, nature spots, restaurants, and activities.
Return JSON array only."""

        try:
            response = llm._call_llm(system_prompt, user_prompt, max_tokens=2000)
            start = response.find('[')
            end = response.rfind(']') + 1
            if start >= 0 and end > start:
                places_data = json.loads(response[start:end])
                enriched = []
                for p in places_data:
                    enriched.append({
                        'name': p.get('name', 'Unknown Place'),
                        'category': p.get('category', 'landmark'),
                        'description': p.get('description', f'A place in {city}'),
                        'latitude': float(p.get('latitude', 0)),
                        'longitude': float(p.get('longitude', 0)),
                        'rating': max(1.0, min(5.0, float(p.get('rating', 4.0)))),
                        'avg_cost_usd': float(p.get('avg_cost_usd', 15)),
                        'avg_duration_minutes': int(p.get('avg_duration_minutes', 90)),
                        'opening_hours': p.get('opening_hours', '08:00-20:00'),
                        'is_outdoor': p.get('is_outdoor', False),
                    })
                return self._create_place_records(enriched, city, country)
        except Exception as e:
            logger.warning(f'LLM-only discovery failed: {e}')

        # Ultimate fallback: generate generic places
        return self._generate_generic_places(city, country, max_places)

    def _generate_generic_places(self, city: str, country: str, max_places: int) -> List:
        """Create generic places when all other methods fail."""
        from places.models import Place

        templates = [
            {'name': f'{city} Central Park', 'category': 'nature', 'description': f'The main park of {city}'},
            {'name': f'{city} Old Town', 'category': 'landmark', 'description': f'Historic center of {city}'},
            {'name': f'{city} National Museum', 'category': 'culture', 'description': f'The national museum in {city}'},
            {'name': f'{city} Grand Bazaar', 'category': 'shopping', 'description': f'The largest market in {city}'},
            {'name': f'{city} Food Street', 'category': 'food', 'description': f'Famous food street in {city}'},
            {'name': f'{city} Beach', 'category': 'relaxation', 'description': f'The main beach near {city}'},
            {'name': f'{city} Viewpoint', 'category': 'adventure', 'description': f'Panoramic viewpoint of {city}'},
            {'name': f'{city} Cathedral', 'category': 'culture', 'description': f'Historic cathedral in {city}'},
            {'name': f'{city} Waterfront', 'category': 'nature', 'description': f'Scenic waterfront in {city}'},
            {'name': f'{city} Night Market', 'category': 'nightlife', 'description': f'Bustling night market in {city}'},
            {'name': f'{city} Palace', 'category': 'landmark', 'description': f'Historic palace in {city}'},
            {'name': f'{city} Botanical Garden', 'category': 'nature', 'description': f'Beautiful botanical garden in {city}'},
            {'name': f'{city} Art Gallery', 'category': 'culture', 'description': f'Contemporary art gallery in {city}'},
            {'name': f'{city} Local Market', 'category': 'food', 'description': f'Local fresh produce market in {city}'},
            {'name': f'{city} Adventure Park', 'category': 'adventure', 'description': f'Outdoor adventure park near {city}'},
        ]

        enriched = []
        for t in templates[:min(max_places, 15)]:
            cat = t['category']
            enriched.append({
                **t,
                'latitude': 0,
                'longitude': 0,
                'rating': round(random.uniform(3.5, 4.8), 1),
                'avg_cost_usd': self._default_cost(cat),
                'avg_duration_minutes': self._default_duration(cat),
                'opening_hours': '08:00-20:00',
                'is_outdoor': CATEGORY_DEFAULTS.get(cat, {}).get('outdoor', False),
            })

        return self._create_place_records(enriched, city, country)

    @transaction.atomic
    def _create_place_records(self, places_data: List[Dict], city: str, country: str) -> List:
        """Create Place model records from enriched data."""
        from places.models import Place

        created = []
        for p in places_data:
            # Parse opening hours into TimeField values
            opening_hour, closing_hour = self._parse_hours(p.get('opening_hours', '08:00-20:00'))

            place, was_created = Place.objects.update_or_create(
                name=p['name'],
                city=city,
                defaults={
                    'country': country,
                    'category': p.get('category', 'landmark'),
                    'description': p.get('description', ''),
                    'latitude': float(p.get('latitude', 0)),
                    'longitude': float(p.get('longitude', 0)),
                    'rating': float(p.get('rating', 4.0)),
                    'avg_cost_usd': Decimal(str(round(float(p.get('avg_cost_usd', 15)), 2))),
                    'avg_duration_minutes': int(p.get('avg_duration_minutes', 90)),
                    'opening_hour': opening_hour,
                    'closing_hour': closing_hour,
                    'is_outdoor': p.get('is_outdoor', False),
                    'popularity_score': round(random.uniform(0.5, 0.95), 2),
                },
            )
            created.append(place)

        return created

    @staticmethod
    def _parse_hours(hours_str: str):
        """Parse '08:00-20:00' into (time(8,0), time(20,0))."""
        try:
            parts = hours_str.split('-')
            open_parts = parts[0].strip().split(':')
            close_parts = parts[1].strip().split(':')
            return (
                dt_time(int(open_parts[0]), int(open_parts[1])),
                dt_time(int(close_parts[0]), int(close_parts[1])),
            )
        except (IndexError, ValueError):
            return dt_time(8, 0), dt_time(20, 0)

    @staticmethod
    def _default_cost(category: str) -> float:
        low, high = CATEGORY_DEFAULTS.get(category, {'cost_range': (10, 30)})['cost_range']
        return round(random.uniform(low, high), 2)

    @staticmethod
    def _default_duration(category: str) -> int:
        low, high = CATEGORY_DEFAULTS.get(category, {'duration_range': (60, 120)})['duration_range']
        return random.randint(low, high)
