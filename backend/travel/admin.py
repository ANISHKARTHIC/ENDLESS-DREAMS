"""Travel admin configuration."""
from django.contrib import admin
from .models import TravelProvider, TravelOption, TravelQueryCache, CurrencyRate


@admin.register(TravelProvider)
class TravelProviderAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'transport_type', 'rating', 'is_active']
    list_filter = ['transport_type', 'is_active']
    search_fields = ['name', 'code']


@admin.register(TravelOption)
class TravelOptionAdmin(admin.ModelAdmin):
    list_display = [
        'provider_name', 'transport_type', 'departure_city', 'arrival_city',
        'departure_time', 'duration_minutes', 'price_inr', 'stops', 'is_mock',
    ]
    list_filter = ['transport_type', 'is_mock', 'departure_city', 'arrival_city']
    search_fields = ['provider_name', 'route_number']


@admin.register(TravelQueryCache)
class TravelQueryCacheAdmin(admin.ModelAdmin):
    list_display = ['cache_key', 'created_at', 'expires_at']
    readonly_fields = ['results']


@admin.register(CurrencyRate)
class CurrencyRateAdmin(admin.ModelAdmin):
    list_display = ['currency_code', 'currency_name', 'symbol', 'rate_from_inr', 'updated_at']
    search_fields = ['currency_code', 'currency_name']
