"""
Telegram Bot — core command handlers.

Supports:
  /start          — Welcome & link instructions
  /trips          — List user's trips
  /trip <id>      — View trip details + today's itinerary
  /weather <city> — Quick weather lookup
  /alter <msg>    — Alter current trip's plan via AI customizer
  /status         — Show today's itinerary progress
  /help           — Command reference
"""
import logging
import json
import requests
from typing import Optional, Dict, Any
from django.conf import settings

logger = logging.getLogger('telegram_bot')

BOT_TOKEN = getattr(settings, 'TELEGRAM_BOT_TOKEN', '')
API_BASE = f'https://api.telegram.org/bot{BOT_TOKEN}'


# ──── Telegram API helpers ────

def send_message(chat_id: int, text: str, parse_mode: str = 'HTML',
                 reply_markup: Optional[Dict] = None) -> bool:
    """Send a message via Telegram Bot API."""
    if not BOT_TOKEN:
        logger.warning('TELEGRAM_BOT_TOKEN not set')
        return False
    payload: Dict[str, Any] = {
        'chat_id': chat_id,
        'text': text,
        'parse_mode': parse_mode,
    }
    if reply_markup:
        payload['reply_markup'] = json.dumps(reply_markup)
    try:
        resp = requests.post(f'{API_BASE}/sendMessage', json=payload, timeout=10)
        resp.raise_for_status()
        return True
    except Exception as e:
        logger.error(f'Telegram sendMessage error: {e}')
        return False


def set_webhook(url: str) -> bool:
    """Set the Telegram webhook URL."""
    if not BOT_TOKEN:
        return False
    try:
        resp = requests.post(f'{API_BASE}/setWebhook', json={'url': url}, timeout=10)
        data = resp.json()
        logger.info(f'Telegram setWebhook: {data}')
        return data.get('ok', False)
    except Exception as e:
        logger.error(f'setWebhook error: {e}')
        return False


# ──── Command Handlers ────

def handle_update(update: Dict[str, Any]) -> None:
    """Process an incoming Telegram update."""
    message = update.get('message')
    if not message:
        return

    chat_id = message['chat']['id']
    user_info = message.get('from', {})
    text = (message.get('text') or '').strip()
    telegram_id = user_info.get('id')

    if not text:
        return

    # Ensure TelegramUser exists
    from telegram_bot.models import TelegramUser, BotMessage
    tg_user, _ = TelegramUser.objects.get_or_create(
        telegram_id=telegram_id,
        defaults={
            'chat_id': chat_id,
            'telegram_username': user_info.get('username', ''),
            'first_name': user_info.get('first_name', ''),
        }
    )
    tg_user.chat_id = chat_id
    tg_user.save(update_fields=['chat_id'])

    # Log incoming
    BotMessage.objects.create(telegram_user=tg_user, direction='in', text=text)

    # Route command
    if text.startswith('/start'):
        response = _handle_start(tg_user)
    elif text.startswith('/trips'):
        response = _handle_trips(tg_user)
    elif text.startswith('/trip'):
        trip_id = text.replace('/trip', '').strip()
        response = _handle_trip_detail(tg_user, trip_id)
    elif text.startswith('/weather'):
        city = text.replace('/weather', '').strip()
        response = _handle_weather(city)
    elif text.startswith('/alter'):
        message_text = text.replace('/alter', '').strip()
        response = _handle_alter(tg_user, message_text)
    elif text.startswith('/status'):
        response = _handle_status(tg_user)
    elif text.startswith('/help'):
        response = _handle_help()
    else:
        # Free text — treat as alter command for active trip
        if tg_user.linked_trip_id:
            response = _handle_alter(tg_user, text)
        else:
            response = _handle_help()

    # Log outgoing & send
    BotMessage.objects.create(telegram_user=tg_user, direction='out', text=response)
    send_message(chat_id, response)


def _handle_start(tg_user) -> str:
    name = tg_user.first_name or tg_user.telegram_username or 'Traveler'
    return (
        f"🌍 <b>Welcome to The Endless Dreams, {name}!</b>\n\n"
        f"I'm your AI travel companion. Here's what I can do:\n\n"
        f"📋 /trips — View your trips\n"
        f"🗺️ /trip <code>id</code> — Trip details & today's plan\n"
        f"🌤️ /weather <code>city</code> — Weather check\n"
        f"✏️ /alter <code>message</code> — Modify today's itinerary\n"
        f"📊 /status — Today's progress\n"
        f"❓ /help — All commands\n\n"
        f"To get started, use /trips to see your trips!"
    )


def _handle_trips(tg_user) -> str:
    from trips.models import Trip
    # Try to find trips by linked django user, or show all recent trips
    trips = Trip.objects.order_by('-created_at')[:10]
    if not trips:
        return "📭 No trips found. Create a trip on the web app first!"

    lines = ["📋 <b>Your Recent Trips:</b>\n"]
    for t in trips:
        status_emoji = {'active': '🟢', 'draft': '📝', 'completed': '✅', 'cancelled': '❌'}.get(t.status, '📍')
        lines.append(
            f"{status_emoji} <b>{t.destination_city}</b> ({t.duration_days}d)\n"
            f"   📅 {t.start_date} → {t.end_date}\n"
            f"   ID: <code>{t.id}</code>\n"
        )
    lines.append("\nUse /trip <code>id</code> to see details")
    return "\n".join(lines)


def _handle_trip_detail(tg_user, trip_id: str) -> str:
    from trips.models import Trip
    from itineraries.models import ItineraryItem
    import datetime

    if not trip_id:
        if tg_user.linked_trip_id:
            trip_id = str(tg_user.linked_trip_id)
        else:
            return "Please provide a trip ID: /trip <code>id</code>"

    try:
        trip = Trip.objects.get(id=trip_id)
    except (Trip.DoesNotExist, ValueError):
        return "❌ Trip not found. Use /trips to see available trips."

    # Link this trip as active
    tg_user.linked_trip_id = trip.id
    tg_user.save(update_fields=['linked_trip_id'])

    # Build header
    lines = [
        f"🗺️ <b>{trip.destination_city}, {trip.destination_country}</b>\n",
        f"📅 {trip.start_date} → {trip.end_date} ({trip.duration_days} days)",
        f"👥 {trip.group_size} traveler{'s' if trip.group_size > 1 else ''}",
        f"🎯 Pace: {trip.pace}",
        f"💰 Budget: ₹{float(trip.budget_usd):,.0f}",
    ]

    if trip.selected_travel_option:
        t = trip.selected_travel_option
        emoji = {'flight': '✈️', 'train': '🚂', 'bus': '🚌'}.get(t.transport_type, '🚗')
        lines.append(f"\n{emoji} <b>Transport:</b> {t.provider_name}")
        lines.append(f"   {trip.departure_city} → {trip.destination_city}")
        lines.append(f"   ⏱️ {t.duration_minutes // 60}h {t.duration_minutes % 60}m · ₹{float(t.price_inr):,.0f}")

    # Today's itinerary
    today = datetime.date.today()
    trip_start = datetime.date.fromisoformat(str(trip.start_date))
    day_number = (today - trip_start).days + 1

    itinerary = trip.itineraries.filter(is_active=True).first()
    if itinerary and 1 <= day_number <= trip.duration_days:
        items = ItineraryItem.objects.filter(
            itinerary=itinerary, day_number=day_number
        ).select_related('place').order_by('order')

        if items:
            lines.append(f"\n📌 <b>Today (Day {day_number}):</b>")
            for item in items:
                status_emoji = {
                    'scheduled': '⬜', 'in_progress': '🔄',
                    'completed': '✅', 'skipped': '⏭️',
                }.get(item.status, '📍')
                name = item.place.name if item.place else 'Unknown'
                time_str = item.start_time[:5] if item.start_time else ''
                lines.append(f"  {status_emoji} {time_str} {name} ({item.duration_minutes}m)")
        else:
            lines.append(f"\n📌 Day {day_number}: No activities scheduled")
    elif itinerary:
        # Show day 1
        items = ItineraryItem.objects.filter(
            itinerary=itinerary, day_number=1
        ).select_related('place').order_by('order')[:5]
        if items:
            lines.append("\n📌 <b>Day 1 Preview:</b>")
            for item in items:
                name = item.place.name if item.place else 'Unknown'
                lines.append(f"  📍 {item.start_time[:5]} {name}")

    lines.append("\n✏️ Use /alter to modify the plan")
    return "\n".join(lines)


def _handle_weather(city: str) -> str:
    if not city:
        return "Please provide a city: /weather <code>city</code>"

    from services.weather_service import WeatherService
    try:
        svc = WeatherService()
        data = svc.get_current_weather(city)
        if data:
            return (
                f"🌤️ <b>Weather in {data.get('city', city)}</b>\n\n"
                f"🌡️ {data.get('temperature', 'N/A')}°C (feels like {data.get('feels_like', 'N/A')}°C)\n"
                f"💨 Wind: {data.get('wind_speed', 'N/A')} m/s\n"
                f"💧 Humidity: {data.get('humidity', 'N/A')}%\n"
                f"☁️ {data.get('description', 'N/A').title()}"
            )
    except Exception as e:
        logger.error(f'Weather fetch error: {e}')

    return f"❌ Could not fetch weather for {city}. Try again later."


def _handle_alter(tg_user, message: str) -> str:
    if not tg_user.linked_trip_id:
        return "❌ No active trip linked. Use /trip <code>id</code> first."

    if not message:
        return ("✏️ Tell me how to modify your trip. Examples:\n"
                "• <i>Add more food spots to Day 2</i>\n"
                "• <i>Remove the museum visit</i>\n"
                "• <i>Make it more budget-friendly</i>\n"
                "• <i>Swap adventure activities for culture</i>")

    from trips.models import Trip
    from itineraries.models import Itinerary, ItineraryItem
    from ai_engine.llm_layer import LLMLayer
    from places.models import Place

    try:
        trip = Trip.objects.get(id=tg_user.linked_trip_id)
    except Trip.DoesNotExist:
        return "❌ Linked trip not found."

    itinerary = trip.itineraries.filter(is_active=True).first()
    if not itinerary:
        return "❌ No active itinerary found for this trip."

    # Use the LLM customizer
    llm = LLMLayer()
    modification = llm.interpret_modification(message)
    items = list(ItineraryItem.objects.filter(itinerary=itinerary).select_related('place').order_by('day_number', 'order'))

    changes_made = []
    available_places = Place.objects.filter(city__iexact=trip.destination_city)

    mod_action = modification.get('action', 'unknown')

    if mod_action == 'swap' and modification.get('target_place'):
        target = modification['target_place'].lower()
        cat = modification.get('replacement_category')
        item_to_swap = None
        for item in items:
            if item.place and target in item.place.name.lower():
                item_to_swap = item
                break
        if item_to_swap:
            existing_ids = [i.place_id for i in items]
            candidates = available_places.exclude(id__in=existing_ids)
            if cat:
                candidates = candidates.filter(category=cat)
            replacement = candidates.order_by('-popularity_score').first()
            if replacement:
                old_name = item_to_swap.place.name
                item_to_swap.place = replacement
                item_to_swap.estimated_cost_usd = replacement.avg_cost_usd
                item_to_swap.save()
                changes_made.append(f"Swapped '{old_name}' → '{replacement.name}'")

    elif mod_action == 'add':
        existing_ids = [i.place_id for i in items]
        candidates = available_places.exclude(id__in=existing_ids)
        cat = modification.get('replacement_category')
        if cat:
            candidates = candidates.filter(category=cat)
        new_place = candidates.order_by('-popularity_score').first()
        if new_place:
            max_day = max(i.day_number for i in items) if items else 1
            target_day = modification.get('target_day') or max_day
            max_order = max((i.order for i in items if i.day_number == target_day), default=0)
            ItineraryItem.objects.create(
                itinerary=itinerary, place=new_place,
                day_number=target_day, order=max_order + 1,
                start_time='14:00', end_time='16:00',
                duration_minutes=new_place.avg_duration_minutes,
                estimated_cost_usd=new_place.avg_cost_usd,
                score=float(new_place.popularity_score) * 10,
            )
            changes_made.append(f"Added '{new_place.name}' to Day {target_day}")

    elif mod_action == 'remove' and modification.get('target_place'):
        target = modification['target_place'].lower()
        for item in items:
            if item.place and target in item.place.name.lower() and not item.is_locked:
                changes_made.append(f"Removed '{item.place.name}'")
                item.delete()
                break

    # Broad category swap fallback
    if not changes_made:
        cat = modification.get('replacement_category')
        if cat:
            existing_ids = [i.place_id for i in items]
            worst = None
            for item in sorted(items, key=lambda x: float(x.score)):
                if not item.is_locked and item.place and item.place.category != cat:
                    worst = item
                    break
            replacement = (
                available_places.exclude(id__in=existing_ids)
                .filter(category=cat).order_by('-popularity_score').first()
            )
            if worst and replacement:
                old_name = worst.place.name
                worst.place = replacement
                worst.estimated_cost_usd = replacement.avg_cost_usd
                worst.save()
                changes_made.append(f"Replaced '{old_name}' → '{replacement.name}' ({cat})")

    if changes_made:
        result = "✅ <b>Changes Applied:</b>\n" + "\n".join(f"  • {c}" for c in changes_made)
        result += "\n\nUse /status to see updated plan"
    else:
        result = "🤔 I couldn't make automatic changes based on your request. Try being more specific:\n"
        result += "• <i>Add food spots to Day 2</i>\n• <i>Remove [place name]</i>\n• <i>More adventure activities</i>"

    return result


def _handle_status(tg_user) -> str:
    import datetime
    from trips.models import Trip
    from itineraries.models import ItineraryItem

    if not tg_user.linked_trip_id:
        return "❌ No active trip. Use /trip <code>id</code> first."

    try:
        trip = Trip.objects.get(id=tg_user.linked_trip_id)
    except Trip.DoesNotExist:
        return "❌ Trip not found."

    today = datetime.date.today()
    trip_start = datetime.date.fromisoformat(str(trip.start_date))
    day_number = (today - trip_start).days + 1

    if day_number < 1 or day_number > trip.duration_days:
        return (
            f"📅 Your trip to {trip.destination_city} "
            f"{'starts' if day_number < 1 else 'has ended'} "
            f"on {trip.start_date}."
        )

    itinerary = trip.itineraries.filter(is_active=True).first()
    if not itinerary:
        return "No active itinerary."

    items = ItineraryItem.objects.filter(
        itinerary=itinerary, day_number=day_number
    ).select_related('place').order_by('order')

    if not items:
        return f"📌 Day {day_number}: No activities scheduled."

    completed = sum(1 for i in items if i.status == 'completed')
    total = items.count()
    progress = int(completed / total * 100) if total else 0

    lines = [
        f"📊 <b>Day {day_number} Progress: {progress}%</b>",
        f"✅ {completed}/{total} activities completed\n",
    ]

    for item in items:
        status_emoji = {
            'scheduled': '⬜', 'in_progress': '🔄',
            'completed': '✅', 'skipped': '⏭️',
        }.get(item.status, '📍')
        name = item.place.name if item.place else 'Unknown'
        time_str = item.start_time[:5] if item.start_time else ''
        cost = f"₹{float(item.estimated_cost_usd):,.0f}" if item.estimated_cost_usd else ''
        lines.append(f"{status_emoji} {time_str} <b>{name}</b> ({item.duration_minutes}m) {cost}")

    lines.append("\n✏️ Use /alter to modify the plan")
    return "\n".join(lines)


def _handle_help() -> str:
    return (
        "❓ <b>The Endless Dreams Bot — Commands</b>\n\n"
        "📋 /trips — List all trips\n"
        "🗺️ /trip <code>id</code> — View trip & today's plan\n"
        "🌤️ /weather <code>city</code> — Weather check\n"
        "✏️ /alter <code>message</code> — AI-modify your plan\n"
        "📊 /status — Today's progress\n"
        "❓ /help — This help message\n\n"
        "💡 <b>Tips:</b>\n"
        "• Link a trip with /trip to enable quick commands\n"
        "• Send any message to alter your active trip's plan\n"
        "• Works best during your trip for real-time changes"
    )
