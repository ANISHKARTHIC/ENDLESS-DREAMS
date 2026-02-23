from django.contrib import admin
from telegram_bot.models import TelegramUser, BotMessage


@admin.register(TelegramUser)
class TelegramUserAdmin(admin.ModelAdmin):
    list_display = ['telegram_id', 'telegram_username', 'first_name', 'user', 'is_active', 'created_at']
    list_filter = ['is_active']
    search_fields = ['telegram_username', 'first_name', 'telegram_id']


@admin.register(BotMessage)
class BotMessageAdmin(admin.ModelAdmin):
    list_display = ['telegram_user', 'direction', 'text', 'created_at']
    list_filter = ['direction']
