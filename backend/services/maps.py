"""Maps service - Mapbox API integration."""
import logging
from typing import Dict, Any, List, Optional, Tuple
from django.conf import settings
from .base import BaseService

logger = logging.getLogger(__name__)


class MapsService(BaseService):
    """Mapbox API integration for directions and geocoding."""

    BASE_URL = 'https://api.mapbox.com'

    def __init__(self):
        super().__init__()
        self.token = getattr(settings, 'MAPBOX_ACCESS_TOKEN', '')

    def get_directions(
        self,
        origin: Tuple[float, float],
        destination: Tuple[float, float],
        waypoints: List[Tuple[float, float]] = None,
        profile: str = 'driving',
    ) -> Dict[str, Any]:
        """Get directions between points."""
        if not self.token:
            return self._mock_directions(origin, destination)

        # Build coordinate string
        coords = [f"{origin[1]},{origin[0]}"]  # lon,lat format
        if waypoints:
            for wp in waypoints:
                coords.append(f"{wp[1]},{wp[0]}")
        coords.append(f"{destination[1]},{destination[0]}")
        coords_str = ';'.join(coords)

        data = self._get(
            f'/directions/v5/mapbox/{profile}/{coords_str}',
            params={
                'access_token': self.token,
                'geometries': 'geojson',
                'overview': 'full',
                'steps': 'true',
            }
        )

        if not data or 'routes' not in data:
            return self._mock_directions(origin, destination)

        route = data['routes'][0]
        return {
            'distance_km': round(route['distance'] / 1000, 2),
            'duration_minutes': round(route['duration'] / 60, 1),
            'geometry': route['geometry'],
            'steps': [
                {
                    'instruction': step['maneuver']['instruction'],
                    'distance': step['distance'],
                    'duration': step['duration'],
                }
                for leg in route['legs']
                for step in leg['steps']
            ],
        }

    def get_route_for_itinerary(self, items: list) -> Dict[str, Any]:
        """Get a route connecting all itinerary items in order."""
        if len(items) < 2:
            return {'routes': [], 'total_distance_km': 0, 'total_duration_minutes': 0}

        coordinates = [(item.place.latitude, item.place.longitude) for item in items]
        routes = []
        total_distance = 0
        total_duration = 0

        for i in range(len(coordinates) - 1):
            route = self.get_directions(coordinates[i], coordinates[i + 1])
            routes.append(route)
            total_distance += route.get('distance_km', 0)
            total_duration += route.get('duration_minutes', 0)

        return {
            'routes': routes,
            'total_distance_km': round(total_distance, 2),
            'total_duration_minutes': round(total_duration, 1),
        }

    def get_traffic_data(self, lat: float, lon: float, dest_lat: float, dest_lon: float) -> Dict:
        """Get traffic conditions between two points."""
        if not self.token:
            return self._mock_traffic()

        directions = self.get_directions((lat, lon), (dest_lat, dest_lon), profile='driving-traffic')

        normal_directions = self.get_directions((lat, lon), (dest_lat, dest_lon), profile='driving')

        delay = directions.get('duration_minutes', 0) - normal_directions.get('duration_minutes', 0)

        return {
            'delay_minutes': max(0, round(delay, 1)),
            'current_duration': directions.get('duration_minutes', 0),
            'normal_duration': normal_directions.get('duration_minutes', 0),
            'congestion_level': 'heavy' if delay > 15 else 'moderate' if delay > 5 else 'light',
        }

    def geocode(self, query: str) -> Optional[Dict[str, Any]]:
        """Geocode a place name to coordinates."""
        if not self.token:
            return self._mock_geocode(query)

        data = self._get(
            f'/geocoding/v5/mapbox.places/{query}.json',
            params={
                'access_token': self.token,
                'limit': 1,
            }
        )

        if not data or not data.get('features'):
            return None

        feature = data['features'][0]
        return {
            'latitude': feature['center'][1],
            'longitude': feature['center'][0],
            'place_name': feature['place_name'],
        }

    @staticmethod
    def _mock_directions(origin, destination) -> Dict:
        import math
        R = 6371
        dlat = math.radians(destination[0] - origin[0])
        dlon = math.radians(destination[1] - origin[1])
        a = (math.sin(dlat/2)**2 + math.cos(math.radians(origin[0])) *
             math.cos(math.radians(destination[0])) * math.sin(dlon/2)**2)
        dist = R * 2 * math.asin(math.sqrt(a))

        return {
            'distance_km': round(dist, 2),
            'duration_minutes': round(dist / 25 * 60, 1),
            'geometry': {
                'type': 'LineString',
                'coordinates': [
                    [origin[1], origin[0]],
                    [destination[1], destination[0]],
                ],
            },
            'steps': [],
            'is_mock': True,
        }

    @staticmethod
    def _mock_traffic() -> Dict:
        return {
            'delay_minutes': 5,
            'current_duration': 25,
            'normal_duration': 20,
            'congestion_level': 'light',
            'is_mock': True,
        }

    @staticmethod
    def _mock_geocode(query: str) -> Dict:
        return {
            'latitude': 0,
            'longitude': 0,
            'place_name': query,
            'is_mock': True,
        }
