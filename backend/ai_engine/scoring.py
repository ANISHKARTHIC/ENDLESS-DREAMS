"""
AI Scoring Engine - Dynamic weighted scoring for place selection.

Score = (Interest × W1) + (Distance Efficiency × W2) - (Risk × W3) - (Fatigue × W4)

Weights adjust based on: trip mode, budget usage, time pressure, weather risk.
"""
import math
import logging
from typing import Dict, List, Any

logger = logging.getLogger('ai_engine')


class ScoringEngine:
    """Scores places based on user preferences, conditions, and trip context."""

    # Base weights
    BASE_WEIGHTS = {
        'interest': 0.40,
        'distance_efficiency': 0.25,
        'risk': 0.20,
        'fatigue': 0.15,
    }

    # Pace multipliers for fatigue weight
    PACE_FATIGUE_MULTIPLIER = {
        'relaxed': 1.5,    # More sensitive to fatigue
        'moderate': 1.0,
        'fast': 0.6,       # Less sensitive to fatigue
    }

    def __init__(self, trip):
        self.trip = trip
        self.interest_weights = trip.get_interest_weights()
        self.pace = trip.pace
        self.budget = float(trip.budget_usd)
        self.budget_spent = float(trip.budget_spent_usd)
        self.duration_days = trip.duration_days
        self.weights = self._calculate_dynamic_weights()

    def _calculate_dynamic_weights(self) -> Dict[str, float]:
        """Adjust weights based on trip context."""
        weights = dict(self.BASE_WEIGHTS)

        # Budget pressure: if spending fast, increase distance efficiency (reduce travel cost)
        budget_ratio = self.budget_spent / self.budget if self.budget > 0 else 0
        if budget_ratio > 0.7:
            weights['distance_efficiency'] += 0.10
            weights['interest'] -= 0.05
            weights['fatigue'] -= 0.05

        # Time pressure: fewer days = prioritize interest over efficiency
        if self.duration_days <= 2:
            weights['interest'] += 0.10
            weights['fatigue'] -= 0.05
            weights['distance_efficiency'] -= 0.05

        # Pace adjustment
        fatigue_mult = self.PACE_FATIGUE_MULTIPLIER.get(self.pace, 1.0)
        weights['fatigue'] *= fatigue_mult

        # Normalize weights to sum to 1
        total = sum(weights.values())
        return {k: v / total for k, v in weights.items()}

    def score_place(self, place, context: Dict[str, Any] = None) -> Dict[str, Any]:
        """Score a single place. Returns score breakdown."""
        context = context or {}

        # Interest score (0-1)
        interest_score = self._calculate_interest_score(place)

        # Distance efficiency (0-1): based on previous location proximity
        distance_score = self._calculate_distance_score(place, context)

        # Risk score (0-1): weather + crowd + safety
        risk_score = self._calculate_risk_score(place)

        # Fatigue score (0-1): based on accumulated activity
        fatigue_score = self._calculate_fatigue_score(place, context)

        # Composite score
        composite = (
            (interest_score * self.weights['interest'])
            + (distance_score * self.weights['distance_efficiency'])
            - (risk_score * self.weights['risk'])
            - (fatigue_score * self.weights['fatigue'])
        )

        # Budget filter: penalize if over daily budget
        budget_penalty = self._calculate_budget_penalty(place)
        composite -= budget_penalty

        # Clamp to 0-1
        composite = max(0.0, min(1.0, composite))

        return {
            'place_id': str(place.id),
            'place': place,
            'total_score': round(composite, 4),
            'breakdown': {
                'interest': round(interest_score, 4),
                'distance_efficiency': round(distance_score, 4),
                'risk': round(risk_score, 4),
                'fatigue': round(fatigue_score, 4),
                'budget_penalty': round(budget_penalty, 4),
            },
            'weights': self.weights,
        }

    def _calculate_interest_score(self, place) -> float:
        """Match place category to user interest weights."""
        category_map = {
            'culture': 'culture',
            'landmark': 'culture',
            'nature': 'nature',
            'food': 'food',
            'adventure': 'adventure',
            'relaxation': 'relaxation',
            'shopping': 'relaxation',
            'nightlife': 'adventure',
        }
        mapped = category_map.get(place.category, 'culture')
        interest_weight = self.interest_weights.get(mapped, 0.5)

        # Combine with place rating and popularity
        rating_norm = place.rating / 5.0
        popularity = place.popularity_score

        return (interest_weight * 0.5) + (rating_norm * 0.3) + (popularity * 0.2)

    def _calculate_distance_score(self, place, context: Dict) -> float:
        """Score based on distance from previous location."""
        prev_lat = context.get('prev_lat')
        prev_lon = context.get('prev_lon')

        if prev_lat is None or prev_lon is None:
            return 0.8  # Default good score for first item

        distance_km = self._haversine(prev_lat, prev_lon, place.latitude, place.longitude)

        # Closer is better: exponential decay
        # 0km = 1.0, 5km = 0.7, 15km = 0.3, 30km+ = ~0.1
        return math.exp(-distance_km / 10.0)

    def _calculate_risk_score(self, place) -> float:
        """Calculate risk from latest metrics."""
        latest_metrics = place.metrics.first() if hasattr(place, '_prefetched_objects_cache') else None

        if latest_metrics is None:
            try:
                latest_metrics = place.metrics.first()
            except Exception:
                pass

        if latest_metrics is None:
            base_risk = 0.1
        else:
            weather_risk = 1.0 - latest_metrics.weather_score
            crowd_risk = latest_metrics.crowd_level * 0.5
            base_risk = latest_metrics.risk_score

            return (weather_risk * 0.4) + (crowd_risk * 0.3) + (base_risk * 0.3)

        # Outdoor places have higher weather sensitivity
        if place.is_outdoor:
            base_risk *= 1.3

        return min(1.0, base_risk)

    def _calculate_fatigue_score(self, place, context: Dict) -> float:
        """Estimate fatigue based on accumulated activities."""
        activities_today = context.get('activities_today', 0)
        total_duration_today = context.get('total_duration_today', 0)

        # More activities = more fatigue
        activity_fatigue = min(1.0, activities_today / 8.0)

        # Duration fatigue: 8+ hours of activities = high fatigue
        duration_fatigue = min(1.0, total_duration_today / 480.0)

        return (activity_fatigue * 0.4) + (duration_fatigue * 0.6)

    def _calculate_budget_penalty(self, place) -> float:
        """Penalize places that exceed remaining daily budget."""
        daily_budget = self.budget / max(1, self.duration_days)
        daily_remaining = daily_budget - (self.budget_spent / max(1, self.duration_days))

        if daily_remaining <= 0:
            return 0.3 if float(place.avg_cost_usd) > 0 else 0

        cost_ratio = float(place.avg_cost_usd) / daily_remaining
        if cost_ratio > 0.5:
            return min(0.3, (cost_ratio - 0.5) * 0.6)
        return 0

    @staticmethod
    def _haversine(lat1, lon1, lat2, lon2) -> float:
        """Calculate distance in km between two points."""
        R = 6371
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (math.sin(dlat / 2) ** 2 +
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
             math.sin(dlon / 2) ** 2)
        c = 2 * math.asin(math.sqrt(a))
        return R * c

    def score_all(self, places) -> List[Dict[str, Any]]:
        """Score all candidate places and return sorted list."""
        scored = []
        context = {
            'prev_lat': None,
            'prev_lon': None,
            'activities_today': 0,
            'total_duration_today': 0,
        }

        for place in places:
            result = self.score_place(place, context)
            scored.append(result)

            # Update context for next place so distance/fatigue scoring works
            if place.latitude and place.longitude:
                context['prev_lat'] = place.latitude
                context['prev_lon'] = place.longitude
            context['activities_today'] = context.get('activities_today', 0) + 1
            context['total_duration_today'] = context.get('total_duration_today', 0) + place.avg_duration_minutes

        # Sort by score descending
        scored.sort(key=lambda x: x['total_score'], reverse=True)

        logger.info(f"Scored {len(scored)} places for trip {self.trip.id}")
        return scored
