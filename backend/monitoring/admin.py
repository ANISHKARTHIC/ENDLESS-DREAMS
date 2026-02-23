from django.contrib import admin
from .models import ReplanEvent, WeatherCache


@admin.register(ReplanEvent)
class ReplanEventAdmin(admin.ModelAdmin):
    list_display = ['trip', 'trigger_type', 'severity', 'was_applied', 'created_at']
    list_filter = ['trigger_type', 'severity', 'was_applied']


@admin.register(WeatherCache)
class WeatherCacheAdmin(admin.ModelAdmin):
    list_display = ['city', 'fetched_at']
