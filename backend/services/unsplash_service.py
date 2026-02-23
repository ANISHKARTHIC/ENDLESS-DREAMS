"""Unsplash API service for high-quality place/destination photos."""
import logging
import time
from typing import Dict, List, Optional

import requests
from django.conf import settings

logger = logging.getLogger('services')

# Simple in-memory cache to avoid hitting rate limits
_cache: Dict[str, dict] = {}
_CACHE_TTL = 3600  # 1 hour


class UnsplashService:
    """Fetch beautiful photos from Unsplash for destinations and places."""

    BASE_URL = 'https://api.unsplash.com'

    def __init__(self):
        self.access_key = getattr(settings, 'UNSPLASH_ACCESS_KEY', '')
        self.headers = {
            'Authorization': f'Client-ID {self.access_key}',
            'Accept-Version': 'v1',
        }

    @property
    def is_configured(self) -> bool:
        return bool(self.access_key)

    def _get_cached(self, key: str) -> Optional[dict]:
        if key in _cache:
            entry = _cache[key]
            if time.time() - entry['ts'] < _CACHE_TTL:
                return entry['data']
            del _cache[key]
        return None

    def _set_cache(self, key: str, data):
        _cache[key] = {'data': data, 'ts': time.time()}

    def search_photos(self, query: str, per_page: int = 5, orientation: str = 'landscape') -> List[Dict]:
        """Search Unsplash for photos matching a query.

        Returns list of photo dicts with urls, attribution, etc.
        """
        if not self.is_configured:
            return []

        cache_key = f'search:{query}:{per_page}:{orientation}'
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached

        try:
            resp = requests.get(
                f'{self.BASE_URL}/search/photos',
                headers=self.headers,
                params={
                    'query': query,
                    'per_page': per_page,
                    'orientation': orientation,
                    'content_filter': 'high',
                },
                timeout=8,
            )
            resp.raise_for_status()
            data = resp.json()
            results = []
            for photo in data.get('results', []):
                results.append(self._format_photo(photo))

            self._set_cache(cache_key, results)
            return results
        except Exception as e:
            logger.warning(f'Unsplash search failed for "{query}": {e}')
            return []

    def get_city_photo(self, city: str, country: str = '') -> Optional[Dict]:
        """Get a single hero photo for a city."""
        query = f'{city} {country} city travel'.strip()
        photos = self.search_photos(query, per_page=1)
        return photos[0] if photos else None

    def get_place_photo(self, place_name: str, city: str = '') -> Optional[Dict]:
        """Get a photo for a specific place/attraction."""
        query = f'{place_name} {city}'.strip()
        photos = self.search_photos(query, per_page=1)
        return photos[0] if photos else None

    def get_destination_photos(self, city: str, country: str = '', count: int = 4) -> List[Dict]:
        """Get multiple photos for a destination."""
        query = f'{city} {country} travel landmark'.strip()
        return self.search_photos(query, per_page=count)

    def get_category_photo(self, category: str, city: str = '') -> Optional[Dict]:
        """Get a photo matching a travel category in a city context."""
        category_queries = {
            'culture': 'museum temple heritage architecture',
            'nature': 'nature park garden scenic landscape',
            'food': 'restaurant food market cuisine street food',
            'adventure': 'adventure hiking outdoor sports',
            'relaxation': 'spa beach resort relaxation',
            'shopping': 'market shopping bazaar',
            'nightlife': 'nightlife bar city lights evening',
            'landmark': 'landmark monument famous building',
        }
        base_query = category_queries.get(category, category)
        query = f'{city} {base_query}'.strip() if city else base_query
        photos = self.search_photos(query, per_page=1)
        return photos[0] if photos else None

    @staticmethod
    def _format_photo(photo: dict) -> Dict:
        """Format Unsplash API photo response to our standard format."""
        urls = photo.get('urls', {})
        user = photo.get('user', {})
        return {
            'id': photo.get('id', ''),
            'url_full': urls.get('full', ''),
            'url_regular': urls.get('regular', ''),
            'url_small': urls.get('small', ''),
            'url_thumb': urls.get('thumb', ''),
            'width': photo.get('width', 0),
            'height': photo.get('height', 0),
            'color': photo.get('color', '#000000'),
            'description': photo.get('description') or photo.get('alt_description', ''),
            'photographer': user.get('name', 'Unknown'),
            'photographer_url': user.get('links', {}).get('html', ''),
            'unsplash_url': photo.get('links', {}).get('html', ''),
            # Unsplash requires attribution
            'attribution': f'Photo by {user.get("name", "Unknown")} on Unsplash',
        }
