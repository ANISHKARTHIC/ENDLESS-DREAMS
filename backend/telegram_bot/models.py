"""Telegram Bot models — link Telegram users to Django users and store chat state."""
import uuid
from django.db import models
from django.conf import settings


class TelegramUser(models.Model):
    """Links a Telegram account to a Django user."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='telegram_profile',
        null=True, blank=True,
    )
    telegram_id = models.BigIntegerField(unique=True, help_text='Telegram user ID')
    telegram_username = models.CharField(max_length=255, blank=True)
    first_name = models.CharField(max_length=255, blank=True)
    chat_id = models.BigIntegerField(help_text='Telegram chat ID for sending messages')
    is_active = models.BooleanField(default=True)
    linked_trip_id = models.UUIDField(null=True, blank=True, help_text='Currently active trip')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'@{self.telegram_username or self.telegram_id}'


class BotMessage(models.Model):
    """Log of bot interactions for debugging."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    telegram_user = models.ForeignKey(TelegramUser, on_delete=models.CASCADE, related_name='messages')
    direction = models.CharField(max_length=10, choices=[('in', 'Incoming'), ('out', 'Outgoing')])
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
