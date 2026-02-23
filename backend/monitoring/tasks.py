"""Celery tasks for background monitoring and replanning."""
import logging
from celery import shared_task
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def monitor_active_trips(self):
    """Background task: monitor all active trips for replanning triggers."""
    from trips.models import Trip
    from itineraries.models import Itinerary
    from monitoring.models import ReplanEvent
    from services.weather import WeatherService
    from ai_engine.replanner import Replanner
    from ai_engine.health import TripHealthCalculator

    active_trips = Trip.objects.filter(status='active').select_related('user')
    weather_service = WeatherService()
    channel_layer = get_channel_layer()

    for trip in active_trips:
        try:
            itinerary = Itinerary.objects.filter(
                trip=trip, is_active=True
            ).prefetch_related('items__place__metrics').first()

            if not itinerary:
                continue

            # Fetch weather
            weather = weather_service.get_current_weather(trip.destination_city)
            weather_risk = weather_service.get_weather_risk_score(trip.destination_city)

            # Check if replanning needed
            replanner = Replanner(trip, itinerary)
            result = replanner.check_and_replan(weather)

            if result:
                # Record replan event
                ReplanEvent.objects.create(
                    trip=trip,
                    trigger_type='weather',
                    severity=result.get('severity', 'medium'),
                    description=f"Weather-triggered replan: {weather.get('condition', '')}",
                    affected_items=[str(item['item_id']) for item in result.get('original_plan', [])],
                    original_plan=result.get('original_plan', {}),
                    new_plan=result.get('new_plan', {}),
                    risk_score_before=weather_risk,
                    risk_score_after=weather_service.get_weather_risk_score(trip.destination_city),
                    was_applied=True,
                )

                # Recalculate health
                health = TripHealthCalculator(trip, itinerary)
                trip.stability_index = health.calculate_stability_index()
                trip.risk_exposure = weather_risk
                trip.save()

                # Notify via WebSocket
                async_to_sync(channel_layer.group_send)(
                    f'trip_{trip.id}',
                    {
                        'type': 'replan_notification',
                        'data': {
                            'trip_id': str(trip.id),
                            'affected_count': result['affected_count'],
                            'severity': result['severity'],
                            'weather': weather,
                            'new_stability': trip.stability_index,
                        },
                    }
                )

            # Always send weather updates
            async_to_sync(channel_layer.group_send)(
                f'trip_{trip.id}',
                {
                    'type': 'weather_update',
                    'data': weather,
                }
            )

        except Exception as e:
            logger.error(f"Error monitoring trip {trip.id}: {e}")

    return f"Monitored {active_trips.count()} active trips"


@shared_task
def update_place_metrics(city: str):
    """Update weather-based metrics for all places in a city."""
    from places.models import Place, PlaceMetrics
    from services.weather import WeatherService

    weather_service = WeatherService()
    weather = weather_service.get_current_weather(city)
    risk = weather_service.get_weather_risk_score(city)

    places = Place.objects.filter(city__iexact=city)

    for place in places:
        weather_score = 1.0 - risk
        if place.is_outdoor:
            weather_score *= 0.8  # Outdoor places more affected

        PlaceMetrics.objects.create(
            place=place,
            weather_score=weather_score,
            risk_score=risk,
            temperature_c=weather.get('temperature'),
            weather_condition=weather.get('condition', ''),
        )

    return f"Updated metrics for {places.count()} places in {city}"
