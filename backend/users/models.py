"""Custom user model for The Endless Dreams."""
from django.contrib.auth.models import AbstractUser
from django.db import models
import uuid


class User(AbstractUser):
    """Extended user with travel preferences."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    avatar_url = models.URLField(blank=True, null=True)

    preferred_pace = models.CharField(
        max_length=20,
        choices=[('relaxed', 'Relaxed'), ('moderate', 'Moderate'), ('fast', 'Fast')],
        default='moderate',
    )
    budget_preference = models.CharField(
        max_length=20,
        choices=[('budget', 'Budget'), ('mid', 'Mid-range'), ('premium', 'Premium')],
        default='mid',
    )
    interest_culture = models.FloatField(default=0.5)
    interest_nature = models.FloatField(default=0.5)
    interest_food = models.FloatField(default=0.5)
    interest_adventure = models.FloatField(default=0.5)
    interest_relaxation = models.FloatField(default=0.5)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'users'
        indexes = [models.Index(fields=['email'])]

    def __str__(self):
        return self.email or self.username

    def get_interest_weights(self):
        return {
            'culture': self.interest_culture,
            'nature': self.interest_nature,
            'food': self.interest_food,
            'adventure': self.interest_adventure,
            'relaxation': self.interest_relaxation,
        }
