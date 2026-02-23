"""Telegram Bot webhook views."""
import json
import logging
from django.http import JsonResponse, HttpResponse
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.conf import settings

from telegram_bot.bot import handle_update, set_webhook, send_message

logger = logging.getLogger('telegram_bot')


@method_decorator(csrf_exempt, name='dispatch')
class TelegramWebhookView(View):
    """Receive updates from Telegram Bot API."""

    def post(self, request):
        try:
            body = json.loads(request.body)
            handle_update(body)
        except Exception as e:
            logger.error(f'Webhook error: {e}')
        # Always return 200 to Telegram
        return JsonResponse({'ok': True})


class TelegramSetupView(View):
    """Setup the Telegram webhook (call once)."""

    def post(self, request):
        webhook_url = getattr(settings, 'TELEGRAM_WEBHOOK_URL', '')
        if not webhook_url:
            return JsonResponse({'error': 'TELEGRAM_WEBHOOK_URL not configured'}, status=400)

        ok = set_webhook(webhook_url)
        return JsonResponse({'ok': ok, 'webhook_url': webhook_url})


class TelegramStatusView(View):
    """Check bot status and linked users."""

    def get(self, request):
        from telegram_bot.models import TelegramUser
        token = getattr(settings, 'TELEGRAM_BOT_TOKEN', '')
        return JsonResponse({
            'bot_configured': bool(token),
            'webhook_url': getattr(settings, 'TELEGRAM_WEBHOOK_URL', ''),
            'linked_users': TelegramUser.objects.count(),
            'active_users': TelegramUser.objects.filter(is_active=True).count(),
        })


class TelegramNotifyView(View):
    """Send a notification to a Telegram user (internal API)."""

    def post(self, request):
        try:
            body = json.loads(request.body)
            telegram_id = body.get('telegram_id')
            message = body.get('message', '')

            if not telegram_id or not message:
                return JsonResponse({'error': 'telegram_id and message required'}, status=400)

            from telegram_bot.models import TelegramUser
            try:
                tg_user = TelegramUser.objects.get(telegram_id=telegram_id)
            except TelegramUser.DoesNotExist:
                return JsonResponse({'error': 'User not found'}, status=404)

            ok = send_message(tg_user.chat_id, message)
            return JsonResponse({'ok': ok})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
