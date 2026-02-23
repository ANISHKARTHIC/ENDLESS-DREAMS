"""Telegram Bot URL configuration."""
from django.urls import path
from telegram_bot.views import (
    TelegramWebhookView,
    TelegramSetupView,
    TelegramStatusView,
    TelegramNotifyView,
)

urlpatterns = [
    path('webhook/', TelegramWebhookView.as_view(), name='telegram-webhook'),
    path('setup/', TelegramSetupView.as_view(), name='telegram-setup'),
    path('status/', TelegramStatusView.as_view(), name='telegram-status'),
    path('notify/', TelegramNotifyView.as_view(), name='telegram-notify'),
]
