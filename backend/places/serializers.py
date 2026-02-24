"""Place serializers."""
from rest_framework import serializers
from .models import Place, PlaceMetrics


class PlaceMetricsSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlaceMetrics
        fields = [
            'id', 'timestamp', 'crowd_level', 'weather_score',
            'risk_score', 'temperature_c', 'weather_condition',
        ]


class PlaceSerializer(serializers.ModelSerializer):
    latest_metrics = serializers.SerializerMethodField()

    class Meta:
        model = Place
        fields = [
            'id', 'name', 'description', 'category', 'city', 'country',
            'latitude', 'longitude', 'avg_duration_minutes', 'avg_cost_usd',
            'rating', 'popularity_score', 'image_url',
            'opening_hour', 'closing_hour', 'is_outdoor',
            'accessibility_score', 'latest_metrics',
        ]

    def get_latest_metrics(self, obj):
        latest = obj.metrics.first()
        if latest:
            return PlaceMetricsSerializer(latest).data
        return None


class PlaceListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views and itinerary cards."""
    class Meta:
        model = Place
        fields = [
            'id', 'name', 'description', 'category', 'city', 'country',
            'latitude', 'longitude', 'rating', 'avg_cost_usd',
            'image_url', 'is_outdoor', 'avg_duration_minutes',
            'opening_hour', 'closing_hour',
        ]
