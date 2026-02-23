from django.contrib import admin
from .models import Trip


@admin.register(Trip)
class TripAdmin(admin.ModelAdmin):
    list_display = ['title', 'destination_city', 'start_date', 'end_date', 'status', 'stability_index']
    list_filter = ['status', 'pace', 'destination_city']
    search_fields = ['title', 'destination_city']
