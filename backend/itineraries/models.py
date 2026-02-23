"""Itinerary models - the generated schedule."""
from django.db import models
import uuid


class Itinerary(models.Model):
    """A day-by-day itinerary for a trip."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trip = models.ForeignKey('trips.Trip', on_delete=models.CASCADE, related_name='itineraries')
    version = models.IntegerField(default=1)
    is_active = models.BooleanField(default=True)
    generated_at = models.DateTimeField(auto_now_add=True)
    generation_time_ms = models.IntegerField(null=True, help_text='Time taken to generate')
    total_score = models.FloatField(default=0.0)

    class Meta:
        db_table = 'itineraries'
        indexes = [models.Index(fields=['trip', '-version'])]
        ordering = ['-version']

    def __str__(self):
        return f"Itinerary v{self.version} for {self.trip}"


class ItineraryItem(models.Model):
    """A single scheduled activity within an itinerary."""
    STATUS_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('skipped', 'Skipped'),
        ('replanned', 'Replanned'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    itinerary = models.ForeignKey(Itinerary, on_delete=models.CASCADE, related_name='items')
    place = models.ForeignKey('places.Place', on_delete=models.CASCADE)
    day_number = models.IntegerField()
    order = models.IntegerField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    duration_minutes = models.IntegerField()
    travel_time_minutes = models.IntegerField(default=0)
    estimated_cost_usd = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    score = models.FloatField(default=0.0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='scheduled')
    notes = models.TextField(blank=True)
    is_locked = models.BooleanField(default=False, help_text='User locked - do not replan')

    class Meta:
        db_table = 'itinerary_items'
        indexes = [
            models.Index(fields=['itinerary', 'day_number', 'order']),
        ]
        ordering = ['day_number', 'order']

    def __str__(self):
        return f"Day {self.day_number}.{self.order}: {self.place.name}"
