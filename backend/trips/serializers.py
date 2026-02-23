"""Trip serializers."""
from rest_framework import serializers
from .models import Trip


class TripCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating trips (public + authenticated)."""
    travel_option_id = serializers.UUIDField(required=False, allow_null=True)

    class Meta:
        model = Trip
        fields = [
            'departure_city', 'destination_city', 'destination_country',
            'start_date', 'end_date', 'budget_usd', 'pace', 'group_size',
            'interest_culture', 'interest_nature', 'interest_food',
            'interest_adventure', 'interest_relaxation',
            'travel_option_id',
        ]

    def validate(self, data):
        if data['start_date'] > data['end_date']:
            raise serializers.ValidationError('Start date must be before end date.')
        if data['budget_usd'] <= 0:
            raise serializers.ValidationError('Budget must be positive.')
        return data


class TripSerializer(serializers.ModelSerializer):
    duration_days = serializers.ReadOnlyField()
    budget_remaining = serializers.ReadOnlyField()
    budget_usage_ratio = serializers.ReadOnlyField()
    itinerary_count = serializers.SerializerMethodField()
    selected_travel_summary = serializers.SerializerMethodField()

    class Meta:
        model = Trip
        fields = [
            'id', 'title', 'departure_city', 'destination_city', 'destination_country',
            'start_date', 'end_date', 'budget_usd', 'budget_spent_usd',
            'pace', 'group_size', 'status',
            'interest_culture', 'interest_nature', 'interest_food',
            'interest_adventure', 'interest_relaxation',
            'stability_index', 'risk_exposure',
            'duration_days', 'budget_remaining', 'budget_usage_ratio',
            'itinerary_count', 'selected_travel_summary',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'budget_spent_usd', 'stability_index', 'risk_exposure',
            'created_at', 'updated_at',
        ]

    def get_itinerary_count(self, obj):
        return obj.itineraries.count()

    def get_selected_travel_summary(self, obj):
        opt = obj.selected_travel_option
        if not opt:
            return None
        return {
            'id': str(opt.id),
            'transport_type': opt.transport_type,
            'provider_name': opt.provider_name,
            'departure_time': opt.departure_time.isoformat() if opt.departure_time else None,
            'arrival_time': opt.arrival_time.isoformat() if opt.arrival_time else None,
            'duration_minutes': opt.duration_minutes,
            'price_inr': str(opt.price_inr),
            'carbon_kg': opt.carbon_kg,
        }


class TripListSerializer(serializers.ModelSerializer):
    duration_days = serializers.ReadOnlyField()
    budget_usage_ratio = serializers.ReadOnlyField()

    class Meta:
        model = Trip
        fields = [
            'id', 'title', 'departure_city', 'destination_city', 'destination_country',
            'start_date', 'end_date', 'status', 'stability_index',
            'duration_days', 'budget_usage_ratio', 'created_at',
        ]
