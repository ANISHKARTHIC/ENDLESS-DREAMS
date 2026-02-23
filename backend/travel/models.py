"""Travel models - journey planning before itinerary generation."""
import uuid
from django.db import models
from django.conf import settings


class TravelProvider(models.Model):
    """Travel providers (airlines, rail companies, bus operators)."""
    TRANSPORT_CHOICES = [
        ('flight', 'Flight'),
        ('train', 'Train'),
        ('bus', 'Bus'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=20, blank=True)
    transport_type = models.CharField(max_length=10, choices=TRANSPORT_CHOICES)
    logo_url = models.URLField(blank=True)
    rating = models.FloatField(default=4.0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'travel_providers'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.transport_type})"


class TravelOption(models.Model):
    """A single travel option (a specific flight/train/bus)."""
    TRANSPORT_CHOICES = TravelProvider.TRANSPORT_CHOICES

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    provider = models.ForeignKey(
        TravelProvider, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='options',
    )
    transport_type = models.CharField(max_length=10, choices=TRANSPORT_CHOICES)
    provider_name = models.CharField(max_length=150, help_text='Denormalized for speed')
    route_number = models.CharField(max_length=30, blank=True)

    departure_city = models.CharField(max_length=100)
    departure_station = models.CharField(max_length=200, blank=True)
    arrival_city = models.CharField(max_length=100)
    arrival_station = models.CharField(max_length=200, blank=True)

    departure_time = models.DateTimeField()
    arrival_time = models.DateTimeField()
    duration_minutes = models.IntegerField()

    price_inr = models.DecimalField(max_digits=12, decimal_places=2, help_text='Price in INR (base currency)')
    price_usd = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Stops
    stops = models.IntegerField(default=0)
    stop_details = models.JSONField(default=list, blank=True)

    # Extra metadata
    cabin_class = models.CharField(max_length=30, blank=True, help_text='Economy, Business, Sleeper, etc.')
    carbon_kg = models.FloatField(default=0, help_text='Estimated CO2 emissions in kg')
    delay_risk = models.FloatField(default=0.1, help_text='0-1, probability of delay')
    amenities = models.JSONField(default=list, blank=True)

    # Bookkeeping
    is_mock = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'travel_options'
        ordering = ['price_inr']
        indexes = [
            models.Index(fields=['departure_city', 'arrival_city', 'departure_time']),
            models.Index(fields=['transport_type']),
        ]

    def __str__(self):
        return f"{self.transport_type} {self.provider_name} {self.departure_city}->{self.arrival_city}"

    @property
    def is_direct(self):
        return self.stops == 0


class TravelQueryCache(models.Model):
    """Cache expensive travel searches for 30 minutes."""
    cache_key = models.CharField(max_length=255, unique=True, db_index=True)
    results = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        db_table = 'travel_query_cache'

    def __str__(self):
        return self.cache_key


class CurrencyRate(models.Model):
    """Cached exchange rates with INR as base."""
    currency_code = models.CharField(max_length=3, unique=True, db_index=True)
    currency_name = models.CharField(max_length=50)
    symbol = models.CharField(max_length=5)
    rate_from_inr = models.DecimalField(max_digits=14, decimal_places=6,
                                         help_text='1 INR = X of this currency')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'currency_rates'
        ordering = ['currency_code']

    def __str__(self):
        return f"{self.currency_code} ({self.rate_from_inr})"
