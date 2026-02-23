"""Mapbox Geocoding & Places service — free-tier alternative to Google Places."""
import logging
import requests
from typing import Dict, Any, List, Optional, Tuple
from django.conf import settings

logger = logging.getLogger(__name__)

MAPBOX_BASE = 'https://api.mapbox.com'


class MapboxPlacesService:
    """Use Mapbox Geocoding API to look up and enrich place coordinates."""

    def __init__(self):
        self.token = getattr(settings, 'MAPBOX_ACCESS_TOKEN', '') or ''

    # ───── Forward Geocoding ─────
    def geocode(self, query: str, *, near: Optional[Tuple[float, float]] = None,
                types: str = 'poi,address', limit: int = 5) -> List[Dict[str, Any]]:
        """Forward-geocode a place name → list of candidate locations.

        Args:
            query:  Free-text search (e.g. "Marina Beach Chennai")
            near:   (lng, lat) proximity bias
            types:  Comma-separated Mapbox place types
            limit:  Max results (1-10)
        """
        if not self.token:
            logger.warning('MAPBOX_ACCESS_TOKEN not set — geocoding disabled')
            return []

        url = f'{MAPBOX_BASE}/geocoding/v5/mapbox.places/{requests.utils.quote(query)}.json'
        params: Dict[str, Any] = {
            'access_token': self.token,
            'types': types,
            'limit': limit,
            'language': 'en',
        }
        if near:
            params['proximity'] = f'{near[0]},{near[1]}'

        try:
            resp = requests.get(url, params=params, timeout=8)
            resp.raise_for_status()
            data = resp.json()
            return [self._parse_feature(f) for f in data.get('features', [])]
        except Exception as e:
            logger.error(f'Mapbox geocode error: {e}')
            return []

    # ───── Reverse Geocoding ─────
    def reverse_geocode(self, lng: float, lat: float) -> Optional[Dict[str, Any]]:
        """Reverse-geocode (lng, lat) → address/place info."""
        if not self.token:
            return None
        url = f'{MAPBOX_BASE}/geocoding/v5/mapbox.places/{lng},{lat}.json'
        params = {'access_token': self.token, 'limit': 1, 'language': 'en'}
        try:
            resp = requests.get(url, params=params, timeout=8)
            resp.raise_for_status()
            features = resp.json().get('features', [])
            return self._parse_feature(features[0]) if features else None
        except Exception as e:
            logger.error(f'Mapbox reverse-geocode error: {e}')
            return None

    # ───── Search POIs in a bounding box ─────
    def search_pois(self, query: str, bbox: Tuple[float, float, float, float],
                    limit: int = 10) -> List[Dict[str, Any]]:
        """Search POIs within a bounding box.

        bbox: (min_lng, min_lat, max_lng, max_lat)
        """
        if not self.token:
            return []
        url = f'{MAPBOX_BASE}/geocoding/v5/mapbox.places/{requests.utils.quote(query)}.json'
        params = {
            'access_token': self.token,
            'bbox': ','.join(str(v) for v in bbox),
            'types': 'poi',
            'limit': min(limit, 10),
            'language': 'en',
        }
        try:
            resp = requests.get(url, params=params, timeout=8)
            resp.raise_for_status()
            return [self._parse_feature(f) for f in resp.json().get('features', [])]
        except Exception as e:
            logger.error(f'Mapbox POI search error: {e}')
            return []

    # ───── Enrich a Place model ─────
    def enrich_place(self, place) -> bool:
        """Try to fill in better lat/lng for a Place model instance.

        Returns True if coordinates were updated.
        """
        query = f'{place.name}, {place.city}, {place.country}'
        near = None
        if place.latitude and place.longitude:
            near = (place.longitude, place.latitude)

        results = self.geocode(query, near=near, limit=1)
        if not results:
            return False

        best = results[0]
        old = (place.latitude, place.longitude)
        place.latitude = best['latitude']
        place.longitude = best['longitude']
        logger.info(f'Enriched "{place.name}": ({old}) → ({best["latitude"]}, {best["longitude"]})')
        return True

    # ───── Batch-enrich all places in a city ─────
    def enrich_city_places(self, city: str, save: bool = True) -> int:
        """Enrich coordinates for all places in a given city. Returns count updated."""
        from places.models import Place
        places = Place.objects.filter(city__iexact=city)
        updated = 0
        for p in places:
            if self.enrich_place(p):
                if save:
                    p.save(update_fields=['latitude', 'longitude'])
                updated += 1
        logger.info(f'Enriched {updated}/{places.count()} places in {city}')
        return updated

    # ───── Search accommodations / hotels ─────
    def search_accommodations(self, city: str, near: Optional[Tuple[float, float]] = None,
                              limit: int = 10) -> List[Dict[str, Any]]:
        """Search for hotels/accommodations in a city."""
        query = f'hotel {city}'
        results = self.geocode(query, near=near, types='poi', limit=limit)
        return [r for r in results if any(
            kw in (r.get('category', '') + r.get('name', '')).lower()
            for kw in ('hotel', 'hostel', 'resort', 'inn', 'lodge', 'guest', 'stay')
        )] or results  # return all if none matched the keyword filter

    # ───── Helpers ─────
    @staticmethod
    def _parse_feature(feature: Dict) -> Dict[str, Any]:
        """Normalise a Mapbox GeoJSON feature to a flat dict."""
        coords = feature.get('geometry', {}).get('coordinates', [0, 0])
        props = feature.get('properties', {})
        context = {c['id'].split('.')[0]: c.get('text', '')
                   for c in feature.get('context', [])} if 'context' in feature else {}

        return {
            'mapbox_id': feature.get('id', ''),
            'name': feature.get('text', feature.get('place_name', '')),
            'full_address': feature.get('place_name', ''),
            'longitude': coords[0],
            'latitude': coords[1],
            'category': props.get('category', ''),
            'maki': props.get('maki', ''),            # Mapbox icon hint
            'city': context.get('place', ''),
            'region': context.get('region', ''),
            'country': context.get('country', ''),
        }
