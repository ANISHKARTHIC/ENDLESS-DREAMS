"""
Dynamic Replanner - Partial itinerary modification.

Monitors conditions and modifies ONLY affected segments.
Maintains trip continuity and recalculates timing.
"""
import logging
from typing import Dict, List, Optional
from django.conf import settings

from .scoring import ScoringEngine
from .optimizer import RouteOptimizer

logger = logging.getLogger('ai_engine')


class Replanner:
    """Handles partial dynamic replanning of itineraries."""

    def __init__(self, trip, itinerary):
        self.trip = trip
        self.itinerary = itinerary
        self.risk_threshold = getattr(settings, 'RISK_THRESHOLD', 0.7)

    def check_and_replan(self, weather_data: Dict, traffic_data: Dict = None) -> Optional[Dict]:
        """
        Check conditions and replan if needed.
        Returns replan result or None if no changes needed.
        """
        affected_items = self._detect_affected_items(weather_data, traffic_data)

        if not affected_items:
            logger.info(f"No replanning needed for trip {self.trip.id}")
            return None

        logger.info(
            f"Replanning {len(affected_items)} items for trip {self.trip.id}"
        )

        return self._replan_affected(affected_items, weather_data)

    def _detect_affected_items(self, weather_data: Dict, traffic_data: Dict = None) -> List:
        """Identify itinerary items affected by conditions."""
        items = self.itinerary.items.select_related('place').filter(
            status='scheduled',
            is_locked=False,
        )

        affected = []
        for item in items:
            risk = self._assess_item_risk(item, weather_data, traffic_data)
            if risk > self.risk_threshold:
                affected.append({
                    'item': item,
                    'risk_score': risk,
                    'reasons': self._get_risk_reasons(item, weather_data, traffic_data),
                })

        return affected

    def _assess_item_risk(self, item, weather_data: Dict, traffic_data: Dict = None) -> float:
        """Calculate risk score for a specific item."""
        risk = 0.0

        # Weather risk
        if weather_data:
            condition = weather_data.get('condition', '').lower()
            wind_speed = weather_data.get('wind_speed', 0)
            temp = weather_data.get('temperature', 20)

            severe_conditions = ['storm', 'thunderstorm', 'heavy rain', 'blizzard', 'hurricane']
            moderate_conditions = ['rain', 'snow', 'fog', 'haze']

            if any(c in condition for c in severe_conditions):
                risk += 0.9 if item.place.is_outdoor else 0.5
            elif any(c in condition for c in moderate_conditions):
                risk += 0.5 if item.place.is_outdoor else 0.2

            if wind_speed > 50:
                risk += 0.3
            if temp < -10 or temp > 42:
                risk += 0.3

        # Traffic risk
        if traffic_data:
            delay_minutes = traffic_data.get('delay_minutes', 0)
            if delay_minutes > 30:
                risk += 0.4
            elif delay_minutes > 15:
                risk += 0.2

        return min(1.0, risk)

    def _get_risk_reasons(self, item, weather_data: Dict, traffic_data: Dict = None) -> List[str]:
        """Get human-readable risk reasons."""
        reasons = []

        if weather_data:
            condition = weather_data.get('condition', '')
            if condition:
                reasons.append(f"Weather: {condition}")
            if item.place.is_outdoor:
                reasons.append("Outdoor venue affected by conditions")

        if traffic_data and traffic_data.get('delay_minutes', 0) > 15:
            reasons.append(f"Traffic delay: {traffic_data['delay_minutes']} minutes")

        return reasons

    def _replan_affected(self, affected_items: List[Dict], weather_data: Dict) -> Dict:
        """Replan only the affected segments."""
        from places.models import Place
        from itineraries.models import ItineraryItem

        original_plan = []
        affected_days = set()

        for affected in affected_items:
            item = affected['item']
            original_plan.append({
                'item_id': str(item.id),
                'place_name': item.place.name,
                'day_number': item.day_number,
                'order': item.order,
            })
            affected_days.add(item.day_number)

        # Get replacement candidates
        used_place_ids = set(
            str(item.place_id) for item in self.itinerary.items.all()
        )
        affected_place_ids = set(
            str(a['item'].place_id) for a in affected_items
        )
        used_place_ids -= affected_place_ids

        # Get alternative places
        alternatives = Place.objects.filter(
            city__iexact=self.trip.destination_city
        ).exclude(
            id__in=used_place_ids
        ).prefetch_related('metrics')

        # Score alternatives
        scorer = ScoringEngine(self.trip)

        # Prefer indoor places during bad weather
        scored = []
        for place in alternatives:
            context = {'weather_condition': weather_data.get('condition', '')}
            result = scorer.score_place(place, context)

            # Boost indoor places during bad weather
            if not place.is_outdoor and weather_data.get('condition', '').lower() in [
                'rain', 'storm', 'snow', 'thunderstorm'
            ]:
                result['total_score'] = min(1.0, result['total_score'] * 1.3)

            scored.append(result)

        scored.sort(key=lambda x: x['total_score'], reverse=True)

        # Replace affected items
        new_plan = []
        replacement_idx = 0

        for affected in affected_items:
            item = affected['item']

            if replacement_idx < len(scored):
                replacement = scored[replacement_idx]
                new_place = replacement['place']

                # Update the item in place
                item.place = new_place
                item.duration_minutes = new_place.avg_duration_minutes
                item.estimated_cost_usd = new_place.avg_cost_usd
                item.score = replacement['total_score']
                item.status = 'replanned'
                item.notes = f"Replanned: {', '.join(affected['reasons'])}"
                item.save()

                new_plan.append({
                    'item_id': str(item.id),
                    'place_name': new_place.name,
                    'day_number': item.day_number,
                    'order': item.order,
                    'score': replacement['total_score'],
                })
                replacement_idx += 1
            else:
                # No replacement available - mark as skipped
                item.status = 'skipped'
                item.notes = f"Skipped: {', '.join(affected['reasons'])}"
                item.save()

        # Recalculate timing for affected days
        self._recalculate_timing(affected_days)

        return {
            'affected_count': len(affected_items),
            'original_plan': original_plan,
            'new_plan': new_plan,
            'trigger': 'weather',
            'severity': 'high' if any(a['risk_score'] > 0.8 for a in affected_items) else 'medium',
        }

    def _recalculate_timing(self, affected_days: set):
        """Recalculate start/end times for affected days."""
        from ai_engine.optimizer import RouteOptimizer

        pace_config = RouteOptimizer.PACE_CONFIG.get(self.trip.pace, RouteOptimizer.PACE_CONFIG['moderate'])

        for day in affected_days:
            items = self.itinerary.items.filter(
                day_number=day
            ).exclude(status='skipped').order_by('order')

            current_time = pace_config['start_hour'] * 60
            buffer = pace_config['buffer_minutes']

            for item in items:
                start = current_time
                end = start + item.duration_minutes

                item.start_time = RouteOptimizer._minutes_to_time_str(start)
                item.end_time = RouteOptimizer._minutes_to_time_str(end)
                item.save(update_fields=['start_time', 'end_time'])

                current_time = end + buffer + item.travel_time_minutes
