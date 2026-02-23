from django.contrib import admin
from .models import Place, PlaceMetrics


@admin.register(Place)
class PlaceAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'city', 'country', 'rating', 'avg_cost_usd']
    list_filter = ['category', 'city', 'country', 'is_outdoor']
    search_fields = ['name', 'city', 'country']


@admin.register(PlaceMetrics)
class PlaceMetricsAdmin(admin.ModelAdmin):
    list_display = ['place', 'timestamp', 'crowd_level', 'weather_score', 'risk_score']
