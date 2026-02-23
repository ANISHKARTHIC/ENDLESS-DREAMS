from django.contrib import admin
from .models import Feedback


@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
    list_display = ['trip', 'rating', 'created_at']
    list_filter = ['rating']
