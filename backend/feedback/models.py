"""User feedback model."""
from django.db import models
from django.conf import settings
import uuid


class Feedback(models.Model):
    """User feedback on itinerary items or trips."""
    RATING_CHOICES = [(i, str(i)) for i in range(1, 6)]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='feedbacks', null=True, blank=True,
    )
    trip = models.ForeignKey('trips.Trip', on_delete=models.CASCADE, related_name='feedbacks')
    itinerary_item = models.ForeignKey(
        'itineraries.ItineraryItem', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='feedbacks',
    )
    rating = models.IntegerField(choices=RATING_CHOICES)
    comment = models.TextField(blank=True)
    tags = models.JSONField(default=list, help_text='e.g. ["too_crowded", "great_food"]')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'feedbacks'
        ordering = ['-created_at']
