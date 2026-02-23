"""Monitoring API views."""
from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import ReplanEvent
from .serializers import ReplanEventSerializer
from services.weather import WeatherService


class ReplanEventListView(generics.ListAPIView):
    serializer_class = ReplanEventSerializer

    def get_queryset(self):
        return ReplanEvent.objects.filter(trip_id=self.kwargs['trip_id'])


class WeatherView(APIView):
    """Get current weather for a city."""

    def get(self, request):
        city = request.query_params.get('city')
        if not city:
            return Response({'error': 'city parameter required'}, status=400)

        service = WeatherService()
        data = service.get_current_weather(city)
        return Response(data)


class WeatherForecastView(APIView):
    """Get weather forecast for a city."""

    def get(self, request):
        city = request.query_params.get('city')
        days = int(request.query_params.get('days', 5))
        if not city:
            return Response({'error': 'city parameter required'}, status=400)

        service = WeatherService()
        data = service.get_forecast(city, days)
        return Response(data)
