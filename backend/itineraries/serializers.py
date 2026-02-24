"""Itinerary serializers."""
from rest_framework import serializers
from .models import Itinerary, ItineraryItem
from places.serializers import PlaceListSerializer


class ItineraryItemSerializer(serializers.ModelSerializer):
    place = PlaceListSerializer(read_only=True)
    place_id = serializers.UUIDField(write_only=True, required=False)

    class Meta:
        model = ItineraryItem
        fields = [
            'id', 'place', 'place_id', 'day_number', 'order',
            'start_time', 'end_time', 'duration_minutes',
            'travel_time_minutes', 'estimated_cost_usd',
            'score', 'status', 'notes', 'is_locked',
        ]
        read_only_fields = ['id', 'score']


class ItinerarySerializer(serializers.ModelSerializer):
    items = ItineraryItemSerializer(many=True, read_only=True)
    day_groups = serializers.SerializerMethodField()

    class Meta:
        model = Itinerary
        fields = [
            'id', 'trip', 'version', 'is_active',
            'generated_at', 'generation_time_ms', 'total_score',
            'items', 'day_groups',
        ]
        read_only_fields = ['id', 'version', 'generated_at', 'generation_time_ms', 'total_score']

    def get_day_groups(self, obj):
        """Group items by day for frontend consumption.
        Always returns all days 1..trip.duration_days so empty days render.
        """
        items = obj.items.select_related('place').order_by('day_number', 'order')
        days: dict = {}
        # Pre-populate all trip days so the frontend always sees every day
        trip = obj.trip
        for d in range(1, trip.duration_days + 1):
            days[d] = []
        for item in items:
            days.setdefault(item.day_number, []).append(ItineraryItemSerializer(item).data)
        return days


class ItineraryItemReorderSerializer(serializers.Serializer):
    """For drag-and-drop reordering."""
    item_id = serializers.UUIDField()
    day_number = serializers.IntegerField()
    order = serializers.IntegerField()
