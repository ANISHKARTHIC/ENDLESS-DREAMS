"""Trip serializers."""
from django.db import models
from rest_framework import serializers
from .models import (
    Trip, TripNote, TripChecklist, ChecklistItem,
    TripExpense, TripPhoto, TripShare, TripCollaborator, SavedPlace,
)


class TripCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating trips (public + authenticated)."""
    # CharField instead of UUIDField so client-side fallback IDs (fb-bus-...) don't fail
    travel_option_id = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    # Metadata for mock/estimated travel options not stored in DB
    travel_summary = serializers.DictField(required=False, allow_null=True, default=None)

    class Meta:
        model = Trip
        fields = [
            'departure_city', 'destination_city', 'destination_country',
            'start_date', 'end_date', 'budget_usd', 'pace', 'stay_type',
            'group_size',
            'interest_culture', 'interest_nature', 'interest_food',
            'interest_adventure', 'interest_relaxation',
            'travel_option_id', 'travel_summary',
        ]

    def validate(self, data):
        if data['start_date'] > data['end_date']:
            raise serializers.ValidationError('Start date must be before end date.')
        if data['budget_usd'] <= 0:
            raise serializers.ValidationError('Budget must be positive.')
        return data


class TripSerializer(serializers.ModelSerializer):
    duration_days = serializers.ReadOnlyField()
    budget_remaining = serializers.ReadOnlyField()
    budget_usage_ratio = serializers.ReadOnlyField()
    itinerary_count = serializers.SerializerMethodField()
    selected_travel_summary = serializers.SerializerMethodField()

    class Meta:
        model = Trip
        fields = [
            'id', 'title', 'departure_city', 'destination_city', 'destination_country',
            'start_date', 'end_date', 'budget_usd', 'budget_spent_usd',
            'pace', 'stay_type', 'group_size', 'status',
            'interest_culture', 'interest_nature', 'interest_food',
            'interest_adventure', 'interest_relaxation',
            'stability_index', 'risk_exposure',
            'duration_days', 'budget_remaining', 'budget_usage_ratio',
            'itinerary_count', 'selected_travel_summary',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'budget_spent_usd', 'stability_index', 'risk_exposure',
            'created_at', 'updated_at',
        ]

    def get_itinerary_count(self, obj):
        return obj.itineraries.count()

    def get_selected_travel_summary(self, obj):
        opt = obj.selected_travel_option
        if not opt:
            return None
        return {
            'id': str(opt.id),
            'transport_type': opt.transport_type,
            'provider_name': opt.provider_name,
            'route_number': getattr(opt, 'route_number', ''),
            'departure_time': opt.departure_time.isoformat() if opt.departure_time else None,
            'arrival_time': opt.arrival_time.isoformat() if opt.arrival_time else None,
            'duration_minutes': opt.duration_minutes,
            'price_inr': str(opt.price_inr),
            'carbon_kg': opt.carbon_kg,
        }


class TripListSerializer(serializers.ModelSerializer):
    duration_days = serializers.ReadOnlyField()
    budget_usage_ratio = serializers.ReadOnlyField()
    cover_image = serializers.ReadOnlyField()
    note_count = serializers.SerializerMethodField()
    expense_total = serializers.SerializerMethodField()

    class Meta:
        model = Trip
        fields = [
            'id', 'title', 'departure_city', 'destination_city', 'destination_country',
            'start_date', 'end_date', 'stay_type', 'status', 'stability_index',
            'duration_days', 'budget_usage_ratio', 'cover_image',
            'note_count', 'expense_total', 'created_at',
        ]

    def get_note_count(self, obj):
        return obj.notes.count()

    def get_expense_total(self, obj):
        total = obj.expenses.aggregate(models.Sum('amount_usd'))['amount_usd__sum']
        return float(total) if total else 0


# ──── Notes ────

class TripNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = TripNote
        fields = ['id', 'trip', 'title', 'content', 'color', 'pinned', 'day_number', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


# ──── Checklists ────

class ChecklistItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChecklistItem
        fields = ['id', 'checklist', 'text', 'checked', 'order', 'created_at']
        read_only_fields = ['id', 'created_at']


class TripChecklistSerializer(serializers.ModelSerializer):
    items = ChecklistItemSerializer(many=True, read_only=True)
    progress = serializers.SerializerMethodField()

    class Meta:
        model = TripChecklist
        fields = ['id', 'trip', 'title', 'icon', 'items', 'progress', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_progress(self, obj):
        total = obj.items.count()
        if total == 0:
            return {'total': 0, 'checked': 0, 'percentage': 0}
        checked = obj.items.filter(checked=True).count()
        return {'total': total, 'checked': checked, 'percentage': round(checked / total * 100)}


# ──── Expenses ────

class TripExpenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = TripExpense
        fields = ['id', 'trip', 'title', 'amount_usd', 'category', 'day_number', 'notes', 'paid_by', 'created_at']
        read_only_fields = ['id', 'created_at']


class ExpenseSummarySerializer(serializers.Serializer):
    total_spent = serializers.FloatField()
    budget_usd = serializers.FloatField()
    remaining = serializers.FloatField()
    by_category = serializers.DictField()
    by_day = serializers.DictField()
    daily_average = serializers.FloatField()


# ──── Photos ────

class TripPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = TripPhoto
        fields = ['id', 'trip', 'image_url', 'caption', 'day_number', 'place_name', 'uploaded_at']
        read_only_fields = ['id', 'uploaded_at']


# ──── Sharing ────

class TripShareSerializer(serializers.ModelSerializer):
    share_url = serializers.SerializerMethodField()

    class Meta:
        model = TripShare
        fields = ['id', 'trip', 'share_code', 'permission', 'is_active', 'share_url', 'created_at', 'expires_at']
        read_only_fields = ['id', 'share_code', 'created_at']

    def get_share_url(self, obj):
        return f"/shared/{obj.share_code}"


# ──── Collaborators ────

class TripCollaboratorSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = TripCollaborator
        fields = ['id', 'trip', 'user', 'username', 'email', 'role', 'joined_at']
        read_only_fields = ['id', 'joined_at']


# ──── Saved Places ────

class SavedPlaceSerializer(serializers.ModelSerializer):
    place_name = serializers.CharField(source='place.name', read_only=True)
    place_city = serializers.CharField(source='place.city', read_only=True)
    place_category = serializers.CharField(source='place.category', read_only=True)
    place_image = serializers.URLField(source='place.image_url', read_only=True)
    place_rating = serializers.FloatField(source='place.rating', read_only=True)

    class Meta:
        model = SavedPlace
        fields = ['id', 'user', 'place', 'trip', 'notes', 'place_name', 'place_city',
                  'place_category', 'place_image', 'place_rating', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']