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

    @property
    def cover_image(self):
        """Get first photo as cover image."""
        photo = self.photos.first()
        return photo.image_url if photo else None

    def get_interest_weights(self):
        return {
            'culture': self.interest_culture,
            'nature': self.interest_nature,
            'food': self.interest_food,
            'adventure': self.interest_adventure,
            'relaxation': self.interest_relaxation,
        }


class TripNote(models.Model):
    """Free-form notes attached to a trip."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='notes')
    title = models.CharField(max_length=255, blank=True, default='')
    content = models.TextField(blank=True, default='')
    color = models.CharField(max_length=20, default='default',
                             help_text='Card colour: default, blue, green, yellow, pink, purple')
    pinned = models.BooleanField(default=False)
    day_number = models.IntegerField(null=True, blank=True,
                                      help_text='Optional link to a specific day')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'trip_notes'
        ordering = ['-pinned', '-updated_at']

    def __str__(self):
        return f"Note: {self.title or 'Untitled'} ({self.trip})"


class TripChecklist(models.Model):
    """A named checklist (e.g. Packing, Documents, To-Do)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='checklists')
    title = models.CharField(max_length=255, default='Packing List')
    icon = models.CharField(max_length=30, default='list-checks')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'trip_checklists'
        ordering = ['created_at']

    def __str__(self):
        return f"{self.title} ({self.trip})"


class ChecklistItem(models.Model):
    """Individual item inside a checklist."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    checklist = models.ForeignKey(TripChecklist, on_delete=models.CASCADE, related_name='items')
    text = models.CharField(max_length=500)
    checked = models.BooleanField(default=False)
    order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'checklist_items'
        ordering = ['order', 'created_at']

    def __str__(self):
        status = '✓' if self.checked else '○'
        return f"{status} {self.text}"


class TripExpense(models.Model):
    """Individual expense entry for budget tracking."""
    CATEGORY_CHOICES = [
        ('food', 'Food & Drinks'),
        ('transport', 'Transport'),
        ('accommodation', 'Accommodation'),
        ('activities', 'Activities & Tickets'),
        ('shopping', 'Shopping'),
        ('other', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='expenses')
    title = models.CharField(max_length=255)
    amount_usd = models.DecimalField(max_digits=10, decimal_places=2)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES, default='other')
    day_number = models.IntegerField(null=True, blank=True)
    notes = models.TextField(blank=True, default='')
    paid_by = models.CharField(max_length=100, blank=True, default='',
                                help_text='Who paid (for group trips)')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'trip_expenses'
        ordering = ['-created_at']

    def __str__(self):
        return f"${self.amount_usd} — {self.title}"


class TripPhoto(models.Model):
    """Photo/image attached to a trip."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='photos')
    image_url = models.URLField(max_length=1000)
    caption = models.CharField(max_length=500, blank=True, default='')
    day_number = models.IntegerField(null=True, blank=True)
    place_name = models.CharField(max_length=255, blank=True, default='')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'trip_photos'
        ordering = ['day_number', 'uploaded_at']

    def __str__(self):
        return f"Photo: {self.caption or 'Untitled'} ({self.trip})"


class TripShare(models.Model):
    """Public share link for a trip."""
    PERMISSION_CHOICES = [
        ('view', 'View Only'),
        ('comment', 'Can Comment'),
        ('edit', 'Can Edit'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='shares')
    share_code = models.CharField(max_length=32, unique=True, db_index=True)
    permission = models.CharField(max_length=20, choices=PERMISSION_CHOICES, default='view')
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'trip_shares'

    def __str__(self):
        return f"Share: {self.share_code} → {self.trip}"


class TripCollaborator(models.Model):
    """Invited collaborators on a trip."""
    ROLE_CHOICES = [
        ('viewer', 'Viewer'),
        ('editor', 'Editor'),
        ('admin', 'Admin'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='collaborators')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='collaborated_trips'
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='viewer')
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='+'
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'trip_collaborators'
        unique_together = ['trip', 'user']

    def __str__(self):
        return f"{self.user} → {self.trip} ({self.role})"


class SavedPlace(models.Model):
    """A user's wishlist / saved places."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='saved_places',
    )
    place = models.ForeignKey(
        'places.Place', on_delete=models.CASCADE,
        related_name='saved_by',
    )
    trip = models.ForeignKey(Trip, on_delete=models.SET_NULL, null=True, blank=True,
                             related_name='saved_places',
                             help_text='Optionally associate with a trip')
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'saved_places'
        unique_together = ['user', 'place']
        ordering = ['-created_at']

    def __str__(self):
        return f"Saved: {self.place.name} by {self.user}"