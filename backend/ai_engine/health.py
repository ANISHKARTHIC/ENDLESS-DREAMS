"""
Trip Health Calculator - Journey Stability Index.

Computes a composite health indicator from:
- Budget deviation
- Risk exposure
- Weather sensitivity
- Time buffer
"""
import logging
from typing import Dict, Any

logger = logging.getLogger('ai_engine')


class TripHealthCalculator:
    """Calculates the Journey Stability Index for a trip."""

    HEALTH_WEIGHTS = {
        'budget': 0.30,
        'risk': 0.25,
        'weather': 0.25,
        'time_buffer': 0.20,
    }

    STATUS_THRESHOLDS = {
        'excellent': 0.85,
        'good': 0.70,
        'fair': 0.50,
        'poor': 0.30,
        'critical': 0.0,
    }

    def __init__(self, trip, itinerary):
        self.trip = trip
        self.itinerary = itinerary

    def calculate_stability_index(self) -> float:
        """Calculate overall stability index (0-1)."""
        budget_health = self._budget_health()
        risk_health = self._risk_health()
        weather_health = self._weather_health()
        time_health = self._time_buffer_health()

        index = (
            budget_health * self.HEALTH_WEIGHTS['budget']
            + risk_health * self.HEALTH_WEIGHTS['risk']
            + weather_health * self.HEALTH_WEIGHTS['weather']
            + time_health * self.HEALTH_WEIGHTS['time_buffer']
        )

        return round(max(0.0, min(1.0, index)), 4)

    def _budget_health(self) -> float:
        """Budget deviation score. 1 = on track, 0 = overspent."""
        if self.trip.budget_usd == 0:
            return 0.5

        ratio = float(self.trip.budget_spent_usd / self.trip.budget_usd)

        # Expected ratio based on trip progress
        from django.utils import timezone
        today = timezone.now().date()
        if today < self.trip.start_date:
            expected_ratio = 0
        elif today > self.trip.end_date:
            expected_ratio = 1.0
        else:
            days_elapsed = (today - self.trip.start_date).days + 1
            expected_ratio = days_elapsed / self.trip.duration_days

        deviation = abs(ratio - expected_ratio)
        return max(0.0, 1.0 - deviation * 2)

    def _risk_health(self) -> float:
        """Risk exposure score from itinerary items."""
        items = self.itinerary.items.select_related('place').all()
        if not items:
            return 0.8

        total_risk = 0
        count = 0

        for item in items:
            if item.status == 'skipped':
                continue
            metrics = item.place.metrics.first()
            if metrics:
                total_risk += metrics.risk_score
            count += 1

        if count == 0:
            return 0.8

        avg_risk = total_risk / count
        return max(0.0, 1.0 - avg_risk)

    def _weather_health(self) -> float:
        """Weather sensitivity score."""
        items = self.itinerary.items.select_related('place').all()
        if not items:
            return 0.8

        outdoor_count = 0
        total = 0
        weather_scores = []

        for item in items:
            if item.status == 'skipped':
                continue
            total += 1
            if item.place.is_outdoor:
                outdoor_count += 1
            metrics = item.place.metrics.first()
            if metrics:
                weather_scores.append(metrics.weather_score)

        if not weather_scores:
            # No weather data available - moderate health
            outdoor_ratio = outdoor_count / max(1, total)
            return 0.8 - (outdoor_ratio * 0.2)  # More outdoor = more weather sensitive

        avg_weather = sum(weather_scores) / len(weather_scores)
        outdoor_factor = 1.0 - (outdoor_count / max(1, total)) * 0.3
        return avg_weather * outdoor_factor

    def _time_buffer_health(self) -> float:
        """Time buffer score based on schedule tightness."""
        items = self.itinerary.items.all()
        if not items:
            return 1.0

        # Group by day
        days = {}
        for item in items:
            if item.day_number not in days:
                days[item.day_number] = []
            days[item.day_number].append(item)

        buffer_scores = []
        for day_items in days.values():
            sorted_items = sorted(day_items, key=lambda x: x.order)
            total_scheduled = sum(
                item.duration_minutes + item.travel_time_minutes
                for item in sorted_items
            )
            # Assume 12-hour window
            available_minutes = 720
            usage_ratio = total_scheduled / available_minutes
            buffer_scores.append(max(0.0, 1.0 - usage_ratio))

        return sum(buffer_scores) / len(buffer_scores) if buffer_scores else 0.8

    def get_status(self, index: float = None) -> str:
        """Get human-readable status from index."""
        if index is None:
            index = self.calculate_stability_index()

        for status, threshold in self.STATUS_THRESHOLDS.items():
            if index >= threshold:
                return status
        return 'critical'

    def get_full_report(self) -> Dict[str, Any]:
        """Generate complete health report."""
        index = self.calculate_stability_index()
        return {
            'stability_index': index,
            'status': self.get_status(index),
            'percentage': round(index * 100, 1),
            'components': {
                'budget_health': round(self._budget_health(), 4),
                'risk_health': round(self._risk_health(), 4),
                'weather_health': round(self._weather_health(), 4),
                'time_buffer_health': round(self._time_buffer_health(), 4),
            },
            'weights': self.HEALTH_WEIGHTS,
        }
