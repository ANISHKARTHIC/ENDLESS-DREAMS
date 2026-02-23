"""
Accommodation Service — Hotel/Stay search using Google Places API.

Uses Google Places API (Text Search) to find REAL hotels, hostels,
resorts, and other accommodation near the destination.
Falls back to Mapbox POI search if Google Places fails.
"""
import math
import logging
import requests
from typing import List, Dict, Any, Optional
from django.conf import settings

logger = logging.getLogger(__name__)

# Stay type → Google Places search query mapping
STAY_TYPE_QUERIES = {
    'hotel': 'hotels',
    'hostel': 'hostels backpacker',
    'resort': 'luxury resort',
    'airbnb': 'serviced apartments vacation rental',
    'boutique': 'boutique hotel',
    'any': 'hotels accommodation',
}

# Price level mapping (Google Places returns 0-4)
PRICE_LEVEL_MULTIPLIER = {
    0: 0.3,   # Free
    1: 0.6,   # Inexpensive
    2: 1.0,   # Moderate
    3: 1.6,   # Expensive
    4: 2.5,   # Very Expensive
}

# Base nightly price per region (USD) for estimating when not provided
REGION_BASE_PRICE = {
    'india': 40, 'southeast_asia': 50, 'east_asia': 90,
    'europe': 120, 'north_america': 150, 'middle_east': 130,
    'oceania': 160, 'south_america': 70, 'africa': 60,
    'default': 100,
}


def _detect_region(country: str) -> str:
    """Rough region detection from country name for price estimation."""
    c = country.lower()
    if any(w in c for w in ['india', 'sri lanka', 'nepal', 'bangladesh', 'pakistan']):
        return 'india'
    if any(w in c for w in ['thailand', 'vietnam', 'indonesia', 'malaysia', 'philippines', 'cambodia', 'myanmar', 'laos', 'singapore']):
        return 'southeast_asia'
    if any(w in c for w in ['japan', 'korea', 'china', 'taiwan', 'hong kong']):
        return 'east_asia'
    if any(w in c for w in ['united states', 'canada', 'mexico']):
        return 'north_america'
    if any(w in c for w in ['united kingdom', 'france', 'germany', 'italy', 'spain', 'portugal', 'netherlands', 'switzerland', 'austria', 'belgium', 'czech', 'poland', 'greece', 'sweden', 'norway', 'denmark', 'finland', 'ireland']):
        return 'europe'
    if any(w in c for w in ['uae', 'dubai', 'saudi', 'qatar', 'oman', 'bahrain', 'kuwait', 'turkey']):
        return 'middle_east'
    if any(w in c for w in ['australia', 'new zealand']):
        return 'oceania'
    return 'default'


class AccommodationService:
    """Finds and ranks accommodation options using Google Places API."""

    def __init__(self):
        self.google_api_key = getattr(settings, 'GOOGLE_PLACES_API_KEY', '')
        self.mapbox_token = getattr(settings, 'MAPBOX_ACCESS_TOKEN', '')

    def search(
        self,
        city: str,
        budget_per_night: float,
        stay_type: Optional[str] = None,
        num_nights: int = 1,
        attraction_centroid: Optional[tuple] = None,
        country: str = '',
    ) -> List[Dict[str, Any]]:
        """
        Search for real accommodation using Google Places API.
        """
        raw_places = []

        # Try Google Places API first
        if self.google_api_key:
            raw_places = self._search_google_places(city, stay_type, attraction_centroid)

        # Fallback to Mapbox POI search
        if not raw_places and self.mapbox_token:
            raw_places = self._search_mapbox_poi(city, stay_type, attraction_centroid)

        if not raw_places:
            logger.warning(f"No accommodation found for {city}")
            return []

        # Estimate prices and rank
        region = _detect_region(country or city)
        base_price = REGION_BASE_PRICE.get(region, 100)

        results = []
        for place in raw_places:
            nightly = base_price

            # Apply price level if available
            price_level = place.get('price_level')
            if price_level is not None:
                nightly = base_price * PRICE_LEVEL_MULTIPLIER.get(price_level, 1.0)

            total_cost = nightly * num_nights

            # Budget feasibility (allow 40% over for showing premium options)
            if nightly > budget_per_night * 1.4:
                continue

            # Infer stay type from place types/name
            place_type = self._infer_stay_type(place)

            # Proximity score
            distance_km = place.get('distance_km', 2.0)
            if attraction_centroid and place.get('lat') and place.get('lng'):
                distance_km = self._haversine(
                    attraction_centroid[0], attraction_centroid[1],
                    place['lat'], place['lng'],
                )
            proximity_score = math.exp(-distance_km / 3.0)

            # Travel time saved estimate
            baseline_km = 5.0
            travel_time_saved_pct = max(0, int((1 - distance_km / baseline_km) * 100))

            # Scoring
            rating = place.get('rating', 4.0)
            price_score = 1 - min(1.0, nightly / max(1, budget_per_night))
            rating_score = rating / 5.0
            type_bonus = 0.10 if place_type == stay_type else 0.05

            optimization_score = (
                proximity_score * 0.35 +
                price_score * 0.30 +
                rating_score * 0.25 +
                type_bonus
            )

            stars = 0
            if rating >= 4.5:
                stars = 5
            elif rating >= 4.0:
                stars = 4
            elif rating >= 3.5:
                stars = 3
            elif rating >= 3.0:
                stars = 2

            results.append({
                'name': place.get('name', 'Unknown Hotel'),
                'type': place_type,
                'stars': stars,
                'price_per_night_usd': round(nightly, 2),
                'total_cost_usd': round(total_cost, 2),
                'rating': rating,
                'amenities': place.get('amenities', []),
                'image_url': place.get('photo_url', ''),
                'description': place.get('vicinity', place.get('address', '')),
                'distance_to_attractions_km': round(distance_km, 1),
                'travel_time_saved_pct': travel_time_saved_pct,
                'optimization_score': round(optimization_score, 3),
                'is_recommended': False,
                'is_mock': False,
            })

        results.sort(key=lambda x: x['optimization_score'], reverse=True)
        if results:
            results[0]['is_recommended'] = True

        return results

    def get_optimal_stay(
        self,
        city: str,
        budget_per_night: float,
        stay_type: Optional[str] = None,
        num_nights: int = 1,
        attraction_centroid: Optional[tuple] = None,
    ) -> Optional[Dict[str, Any]]:
        """Get the single best accommodation option."""
        results = self.search(city, budget_per_night, stay_type, num_nights, attraction_centroid)
        return results[0] if results else None

    # ── Google Places API ────────────────────────────────────────────────

    def _search_google_places(
        self, city: str, stay_type: Optional[str], centroid: Optional[tuple]
    ) -> List[Dict[str, Any]]:
        """Search Google Places API for real hotels/accommodation."""
        query_type = STAY_TYPE_QUERIES.get(stay_type or 'any', 'hotels accommodation')
        query = f"{query_type} in {city}"

        try:
            params: dict = {
                'query': query,
                'key': self.google_api_key,
                'type': 'lodging',
                'language': 'en',
            }
            if centroid:
                params['location'] = f"{centroid[0]},{centroid[1]}"
                params['radius'] = '10000'

            resp = requests.get(
                'https://maps.googleapis.com/maps/api/place/textsearch/json',
                params=params,
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()

            if data.get('status') != 'OK':
                logger.warning(f"Google Places: {data.get('status')} - {data.get('error_message', '')}")
                return []

            places = []
            for result in data.get('results', [])[:10]:
                loc = result.get('geometry', {}).get('location', {})
                photo_url = ''
                if result.get('photos'):
                    photo_ref = result['photos'][0].get('photo_reference', '')
                    if photo_ref:
                        photo_url = (
                            f"https://maps.googleapis.com/maps/api/place/photo"
                            f"?maxwidth=400&photo_reference={photo_ref}&key={self.google_api_key}"
                        )

                places.append({
                    'name': result.get('name', ''),
                    'lat': loc.get('lat', 0),
                    'lng': loc.get('lng', 0),
                    'rating': result.get('rating', 4.0),
                    'user_ratings_total': result.get('user_ratings_total', 0),
                    'price_level': result.get('price_level'),
                    'vicinity': result.get('formatted_address', ''),
                    'types': result.get('types', []),
                    'photo_url': photo_url,
                    'amenities': self._extract_amenities(result),
                })
            return places

        except Exception as e:
            logger.error(f"Google Places search failed: {e}")
            return []

    # ── Mapbox fallback ─────────────────────────────────────────────────

    def _search_mapbox_poi(
        self, city: str, stay_type: Optional[str], centroid: Optional[tuple]
    ) -> List[Dict[str, Any]]:
        """Fallback: Search Mapbox for accommodation POIs."""
        query = f"hotel {city}" if not stay_type or stay_type == 'any' else f"{stay_type} {city}"

        try:
            params: dict = {
                'access_token': self.mapbox_token,
                'types': 'poi',
                'limit': '10',
                'language': 'en',
            }
            if centroid:
                params['proximity'] = f"{centroid[1]},{centroid[0]}"

            resp = requests.get(
                f"https://api.mapbox.com/geocoding/v5/mapbox.places/{requests.utils.quote(query)}.json",
                params=params,
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()

            places = []
            for feature in data.get('features', []):
                coords = feature.get('geometry', {}).get('coordinates', [0, 0])
                places.append({
                    'name': feature.get('text', ''),
                    'lat': coords[1],
                    'lng': coords[0],
                    'rating': 4.0,
                    'vicinity': feature.get('place_name', ''),
                    'types': feature.get('properties', {}).get('category', '').split(', '),
                    'photo_url': '',
                    'amenities': ['WiFi'],
                })
            return places

        except Exception as e:
            logger.error(f"Mapbox POI search failed: {e}")
            return []

    # ── Helpers ──────────────────────────────────────────────────────────

    @staticmethod
    def _extract_amenities(place_data: dict) -> list:
        """Extract amenities from Google Places types."""
        types = place_data.get('types', [])
        amenities = ['WiFi']

        type_amenity_map = {
            'spa': 'Spa', 'gym': 'Gym', 'restaurant': 'Restaurant',
            'bar': 'Bar', 'parking': 'Parking', 'pool': 'Pool', 'laundry': 'Laundry',
        }
        for t in types:
            for key, amenity in type_amenity_map.items():
                if key in t.lower():
                    amenities.append(amenity)

        price_level = place_data.get('price_level', 2)
        if price_level and price_level >= 3:
            amenities.extend(['Pool', 'Concierge'])
        if price_level and price_level >= 4:
            amenities.extend(['Fine Dining', 'Spa'])

        return list(set(amenities))

    @staticmethod
    def _infer_stay_type(place: dict) -> str:
        """Infer stay type from place data."""
        name_lower = place.get('name', '').lower()
        types = [t.lower() for t in place.get('types', [])]

        if any(w in name_lower for w in ['hostel', 'backpacker', 'dormitory']):
            return 'hostel'
        if any(w in name_lower for w in ['resort', 'spa resort', 'beach resort']):
            return 'resort'
        if any(w in name_lower for w in ['boutique', 'design hotel']):
            return 'boutique'
        if any(w in name_lower for w in ['apartment', 'flat', 'suite', 'vacation rental', 'airbnb', 'homestay']):
            return 'airbnb'
        if any('resort' in t for t in types):
            return 'resort'
        return 'hotel'

    @staticmethod
    def _haversine(lat1, lon1, lat2, lon2) -> float:
        R = 6371
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (math.sin(dlat / 2) ** 2 +
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
             math.sin(dlon / 2) ** 2)
        return R * 2 * math.asin(math.sqrt(a))
