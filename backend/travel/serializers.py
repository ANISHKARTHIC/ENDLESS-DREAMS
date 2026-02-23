"""Travel serializers."""
from rest_framework import serializers
from .models import TravelOption, TravelProvider, CurrencyRate


class TravelSearchSerializer(serializers.Serializer):
    """Input for travel search."""
    departure_city = serializers.CharField(max_length=100)
    arrival_city = serializers.CharField(max_length=100)
    travel_date = serializers.DateField()
    transport_types = serializers.ListField(
        child=serializers.ChoiceField(choices=['flight', 'train', 'bus']),
        required=False,
        default=['flight', 'train', 'bus'],
    )

    def validate(self, data):
        if data['departure_city'].lower() == data['arrival_city'].lower():
            raise serializers.ValidationError('Departure and arrival cities must be different.')
        return data


class TravelProviderSerializer(serializers.ModelSerializer):
    class Meta:
        model = TravelProvider
        fields = ['id', 'name', 'code', 'transport_type', 'logo_url', 'rating']


class TravelOptionSerializer(serializers.ModelSerializer):
    is_direct = serializers.ReadOnlyField()
    badges = serializers.SerializerMethodField()

    class Meta:
        model = TravelOption
        fields = [
            'id', 'transport_type', 'provider_name', 'route_number',
            'departure_city', 'departure_station', 'arrival_city', 'arrival_station',
            'departure_time', 'arrival_time', 'duration_minutes',
            'price_inr', 'price_usd', 'stops', 'stop_details',
            'cabin_class', 'carbon_kg', 'delay_risk', 'amenities',
            'is_direct', 'is_mock', 'created_at',
        ]

    def get_badges(self, obj):
        # Badges are injected by the view, not from DB
        return getattr(obj, '_badges', [])


class CurrencyRateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CurrencyRate
        fields = ['currency_code', 'currency_name', 'symbol', 'rate_from_inr', 'updated_at']
