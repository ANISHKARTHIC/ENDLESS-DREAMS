"""Places and place metrics models."""
from django.db import models
import uuid


class Place(models.Model):
    """A visitable location with metadata."""
    CATEGORY_CHOICES = [
        ('culture', 'Culture & Heritage'),
        ('nature', 'Nature & Outdoors'),
        ('food', 'Food & Dining'),
        ('adventure', 'Adventure & Sports'),
        ('relaxation', 'Relaxation & Wellness'),
        ('shopping', 'Shopping'),
        ('nightlife', 'Nightlife'),
        ('landmark', 'Landmark'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    city = models.CharField(max_length=100, db_index=True)
    country = models.CharField(max_length=100, db_index=True)
    latitude = models.FloatField()
    longitude = models.FloatField()
    avg_duration_minutes = models.IntegerField(default=60)
    avg_cost_usd = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    rating = models.FloatField(default=4.0)
    popularity_score = models.FloatField(default=0.5)
    image_url = models.URLField(blank=True, null=True)
    opening_hour = models.TimeField(null=True, blank=True)
    closing_hour = models.TimeField(null=True, blank=True)
    is_outdoor = models.BooleanField(default=False)
    accessibility_score = models.FloatField(default=0.8)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'places'
        indexes = [
            models.Index(fields=['city', 'category']),
            models.Index(fields=['latitude', 'longitude']),
        ]
        ordering = ['-rating']

    def __str__(self):
        return f"{self.name} ({self.city})"


class PlaceMetrics(models.Model):
    """Time-series metrics for a place."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    place = models.ForeignKey(Place, on_delete=models.CASCADE, related_name='metrics')
    timestamp = models.DateTimeField(auto_now_add=True)
    crowd_level = models.FloatField(default=0.5, help_text='0=empty, 1=packed')
    weather_score = models.FloatField(default=0.8, help_text='0=terrible, 1=perfect')
    risk_score = models.FloatField(default=0.0, help_text='0=safe, 1=dangerous')
    temperature_c = models.FloatField(null=True, blank=True)
    weather_condition = models.CharField(max_length=50, blank=True)

    class Meta:
        db_table = 'place_metrics'
        indexes = [models.Index(fields=['place', '-timestamp'])]
        ordering = ['-timestamp']
