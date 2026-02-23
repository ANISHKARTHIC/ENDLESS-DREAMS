"""Monitoring serializers."""
from rest_framework import serializers
from .models import ReplanEvent


class ReplanEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReplanEvent
        fields = [
            'id', 'trip', 'trigger_type', 'severity', 'description',
            'affected_items', 'risk_score_before', 'risk_score_after',
            'was_applied', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']
