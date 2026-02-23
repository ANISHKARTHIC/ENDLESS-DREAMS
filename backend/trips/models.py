"""Trip model - the core entity."""
from django.db import models
from django.conf import settings
import uuid


class Trip(models.Model):
    """A user's trip plan."""
    PACE_CHOICES = [
        ('relaxed', 'Relaxed'),
        ('moderate', 'Moderate'),
        ('fast', 'Fast'),
    ]
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    STAY_TYPE_CHOICES = [
        ('hotel', 'Hotel'),
        ('hostel', 'Hostel'),
        ('resort', 'Resort'),
        ('airbnb', 'Airbnb'),
        ('boutique', 'Boutique'),
        ('any', 'Any'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='trips', null=True, blank=True,
    )
    session_id = models.CharField(max_length=64, blank=True, db_index=True,
                                   help_text='For anonymous users')
    title = models.CharField(max_length=255)
    departure_city = models.CharField(max_length=100, blank=True, default='',
                                       help_text='City of departure')
    destination_city = models.CharField(max_length=100)
    destination_country = models.CharField(max_length=100)
    start_date = models.DateField()
    end_date = models.DateField()
    budget_usd = models.DecimalField(max_digits=10, decimal_places=2)
    budget_spent_usd = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    pace = models.CharField(max_length=20, choices=PACE_CHOICES, default='moderate')
    stay_type = models.CharField(max_length=20, choices=STAY_TYPE_CHOICES, default='any',
                                  help_text='Preferred accommodation type')
    group_size = models.IntegerField(default=1)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')

    # Selected travel option
    selected_travel_option = models.ForeignKey(
        'travel.TravelOption', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='trips',
        help_text='The travel option chosen by the user for this trip',
    )

    # Interest weights for this trip
    interest_culture = models.FloatField(default=0.5)
    interest_nature = models.FloatField(default=0.5)
    interest_food = models.FloatField(default=0.5)
    interest_adventure = models.FloatField(default=0.5)
    interest_relaxation = models.FloatField(default=0.5)

    # Health metrics
    stability_index = models.FloatField(default=1.0)
    risk_exposure = models.FloatField(default=0.0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'trips'
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['session_id']),
            models.Index(fields=['destination_city']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} - {self.destination_city}"

    @property
    def duration_days(self):
        return (self.end_date - self.start_date).days + 1

    @property
    def budget_remaining(self):
        return self.budget_usd - self.budget_spent_usd

    @property
    def budget_usage_ratio(self):
        if self.budget_usd == 0:
            return 0
        return float(self.budget_spent_usd / self.budget_usd)

    def get_interest_weights(self):
        return {
            'culture': self.interest_culture,
            'nature': self.interest_nature,
            'food': self.interest_food,
            'adventure': self.interest_adventure,
            'relaxation': self.interest_relaxation,
        }
