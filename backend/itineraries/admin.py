from django.contrib import admin
from .models import Itinerary, ItineraryItem


class ItineraryItemInline(admin.TabularInline):
    model = ItineraryItem
    extra = 0


@admin.register(Itinerary)
class ItineraryAdmin(admin.ModelAdmin):
    list_display = ['trip', 'version', 'is_active', 'total_score', 'generated_at']
    inlines = [ItineraryItemInline]


@admin.register(ItineraryItem)
class ItineraryItemAdmin(admin.ModelAdmin):
    list_display = ['itinerary', 'place', 'day_number', 'order', 'start_time', 'status']
