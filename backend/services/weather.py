"""Weather service - OpenWeather API integration."""
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from django.conf import settings
from django.utils import timezone
from .base import BaseService

logger = logging.getLogger(__name__)


class WeatherService(BaseService):
    """OpenWeather API integration with caching."""

    BASE_URL = 'https://api.openweathermap.org/data/2.5'

    def __init__(self):
        super().__init__()
        self.api_key = getattr(settings, 'OPENWEATHER_API_KEY', '')

    def get_current_weather(self, city: str) -> Dict[str, Any]:
        """Get current weather for a city. Uses cache if available."""
        cached = self._get_cached(city)
        if cached:
            return cached

        if not self.api_key:
            return self._mock_weather(city)

        data = self._get('/weather', params={
            'q': city,
            'appid': self.api_key,
            'units': 'metric',
        })

        if not data:
            return self._mock_weather(city)

        result = {
            'city': city,
            'temperature': data['main']['temp'],
            'feels_like': data['main']['feels_like'],
            'humidity': data['main']['humidity'],
            'condition': data['weather'][0]['main'],
            'description': data['weather'][0]['description'],
            'icon': data['weather'][0]['icon'],
            'wind_speed': data['wind']['speed'],
            'wind_deg': data['wind'].get('deg', 0),
            'clouds': data['clouds']['all'],
            'visibility': data.get('visibility', 10000),
            'timestamp': timezone.now().isoformat(),
        }

        self._cache_weather(city, result)
        return result

    def get_forecast(self, city: str, days: int = 5) -> Dict[str, Any]:
        """Get weather forecast."""
        if not self.api_key:
            return self._mock_forecast(city, days)

        data = self._get('/forecast', params={
            'q': city,
            'appid': self.api_key,
            'units': 'metric',
            'cnt': min(days * 8, 40),  # 3-hour intervals
        })

        if not data:
            return self._mock_forecast(city, days)

        forecasts = []
        for item in data.get('list', []):
            forecasts.append({
                'datetime': item['dt_txt'],
                'temperature': item['main']['temp'],
                'condition': item['weather'][0]['main'],
                'description': item['weather'][0]['description'],
                'icon': item['weather'][0]['icon'],
                'wind_speed': item['wind']['speed'],
                'humidity': item['main']['humidity'],
                'rain_probability': item.get('pop', 0),
            })

        return {
            'city': city,
            'forecasts': forecasts,
        }

    def get_weather_risk_score(self, city: str) -> float:
        """Calculate weather risk score (0-1) for a city."""
        weather = self.get_current_weather(city)

        risk = 0.0
        condition = weather.get('condition', '').lower()

        severe = ['storm', 'thunderstorm', 'hurricane', 'tornado']
        moderate = ['rain', 'snow', 'drizzle']
        mild = ['fog', 'haze', 'mist', 'clouds']

        if any(c in condition for c in severe):
            risk += 0.8
        elif any(c in condition for c in moderate):
            risk += 0.4
        elif any(c in condition for c in mild):
            risk += 0.1

        wind = weather.get('wind_speed', 0)
        if wind > 60:
            risk += 0.3
        elif wind > 30:
            risk += 0.15

        temp = weather.get('temperature', 20)
        if temp < -15 or temp > 45:
            risk += 0.3
        elif temp < 0 or temp > 38:
            risk += 0.1

        return min(1.0, risk)

    def _get_cached(self, city: str) -> Optional[Dict]:
        """Check weather cache."""
        try:
            from monitoring.models import WeatherCache
            cutoff = timezone.now() - timedelta(minutes=30)
            cache = WeatherCache.objects.filter(
                city__iexact=city,
                fetched_at__gte=cutoff
            ).first()
            if cache:
                return cache.data
        except Exception:
            pass
        return None

    def _cache_weather(self, city: str, data: Dict):
        """Store weather in cache."""
        try:
            from monitoring.models import WeatherCache
            WeatherCache.objects.update_or_create(
                city__iexact=city,
                defaults={
                    'city': city,
                    'latitude': 0,
                    'longitude': 0,
                    'data': data,
                }
            )
        except Exception as e:
            logger.warning(f"Failed to cache weather: {e}")

    @staticmethod
    def _mock_weather(city: str) -> Dict[str, Any]:
        """Return mock weather data when API key is not set."""
        return {
            'city': city,
            'temperature': 24,
            'feels_like': 26,
            'humidity': 55,
            'condition': 'Clear',
            'description': 'clear sky',
            'icon': '01d',
            'wind_speed': 12,
            'wind_deg': 180,
            'clouds': 10,
            'visibility': 10000,
            'timestamp': timezone.now().isoformat(),
            'is_mock': True,
        }

    @staticmethod
    def _mock_forecast(city: str, days: int) -> Dict[str, Any]:
        """Return mock forecast data."""
        forecasts = []
        base = datetime.now()
        conditions = ['Clear', 'Clouds', 'Clear', 'Rain', 'Clear', 'Clouds', 'Clear', 'Clear']

        for i in range(days * 4):
            dt = base + timedelta(hours=i * 6)
            forecasts.append({
                'datetime': dt.strftime('%Y-%m-%d %H:%M:%S'),
                'temperature': 22 + (i % 5) * 2,
                'condition': conditions[i % len(conditions)],
                'description': conditions[i % len(conditions)].lower(),
                'icon': '01d',
                'wind_speed': 10 + i % 8,
                'humidity': 50 + i % 20,
                'rain_probability': 0.1 if conditions[i % len(conditions)] == 'Rain' else 0,
            })

        return {'city': city, 'forecasts': forecasts, 'is_mock': True}
