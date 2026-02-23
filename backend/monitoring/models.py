"""Monitoring and replanning event models."""
from django.db import models
import uuid


class ReplanEvent(models.Model):
    """Records each replanning decision."""
    TRIGGER_CHOICES = [
        ('weather', 'Weather Alert'),
        ('traffic', 'Traffic Disruption'),
        ('closure', 'Venue Closure'),
        ('user', 'User Request'),
        ('schedule', 'Scheduled Check'),
    ]
    SEVERITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trip = models.ForeignKey('trips.Trip', on_delete=models.CASCADE, related_name='replan_events')
    trigger_type = models.CharField(max_length=20, choices=TRIGGER_CHOICES)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='low')
    description = models.TextField()
    affected_items = models.JSONField(default=list, help_text='List of affected item IDs')
    original_plan = models.JSONField(default=dict)
    new_plan = models.JSONField(default=dict)
    risk_score_before = models.FloatField(default=0.0)
    risk_score_after = models.FloatField(default=0.0)
    was_applied = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'replan_events'
        indexes = [models.Index(fields=['trip', '-created_at'])]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.trigger_type} event for {self.trip} ({self.severity})"


class WeatherCache(models.Model):
    """Cached weather data to reduce API calls."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    city = models.CharField(max_length=100, db_index=True)
    latitude = models.FloatField()
    longitude = models.FloatField()
    data = models.JSONField()
    fetched_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'weather_cache'
        indexes = [models.Index(fields=['city', '-fetched_at'])]
