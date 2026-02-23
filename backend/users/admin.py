from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['username', 'email', 'preferred_pace', 'budget_preference', 'created_at']
    list_filter = ['preferred_pace', 'budget_preference']
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Travel Preferences', {
            'fields': (
                'avatar_url', 'preferred_pace', 'budget_preference',
                'interest_culture', 'interest_nature', 'interest_food',
                'interest_adventure', 'interest_relaxation',
            )
        }),
    )
