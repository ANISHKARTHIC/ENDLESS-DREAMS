"""
Route Optimizer - Algorithmic itinerary generation.

Takes scored places and produces an optimized day-by-day schedule.
Uses nearest-neighbor heuristic with time-window constraints.
"""
import math
import logging
from datetime import time as dt_time, datetime, timedelta
from typing import Dict, List, Any
from decimal import Decimal

logger = logging.getLogger('ai_engine')


class RouteOptimizer:
    """Generates optimized itinerary from scored places."""

    # Time constants
    PACE_CONFIG = {
        'relaxed': {
            'start_hour': 10,
            'end_hour': 19,
            'max_activities': 4,
            'buffer_minutes': 30,
            'meal_breaks': [('13:00', 60)],  # (start_time, duration_minutes)
        },
        'moderate': {
            'start_hour': 9,
            'end_hour': 21,
            'max_activities': 6,
            'buffer_minutes': 20,
            'meal_breaks': [('12:30', 45), ('19:30', 60)],
        },
        'fast': {
            'start_hour': 8,
            'end_hour': 22,
            'max_activities': 8,
            'buffer_minutes': 15,
            'meal_breaks': [('12:00', 30), ('19:00', 45)],
        },
    }

    # Estimated meal cost fractions of daily budget
    MEAL_COST_FRACTION = 0.25   # meals ~ 25% of daily budget
    TRANSPORT_LOCAL_FRACTION = 0.10  # local transport ~ 10%
    ACTIVITY_BUDGET_FRACTION = 0.65  # 65% of daily budget for activities

    def __init__(self, trip, scored_places: List[Dict[str, Any]]):
        self.trip = trip
        self.scored_places = scored_places
        self.pace_config = self.PACE_CONFIG.get(trip.pace, self.PACE_CONFIG['moderate'])
        self.duration_days = trip.duration_days
        # Use only activity budget fraction so meals/transport aren't over-counted
        self.daily_budget = (float(trip.budget_usd) / max(1, self.duration_days)) * self.ACTIVITY_BUDGET_FRACTION

    def optimize(self) -> List[Dict[str, Any]]:
        """Generate full itinerary. Returns list of item dicts."""
        itinerary_items = []
        used_places = set()
        remaining = list(self.scored_places)

        for day in range(1, self.duration_days + 1):
            day_items = self._plan_day(day, remaining, used_places)
            itinerary_items.extend(day_items)

            # Remove used places
            for item in day_items:
                used_places.add(item['place_id'])

            remaining = [p for p in remaining if p['place_id'] not in used_places]

        logger.info(
            f"Generated {len(itinerary_items)} items over {self.duration_days} days "
            f"for trip {self.trip.id}"
        )
        return itinerary_items

    def _plan_day(self, day_number: int, available: List[Dict], used: set) -> List[Dict]:
        """Plan activities for a single day using greedy nearest-neighbor with meal breaks."""
        items = []
        current_time = self.pace_config['start_hour'] * 60  # minutes from midnight
        end_time = self.pace_config['end_hour'] * 60
        max_activities = self.pace_config['max_activities']
        buffer = self.pace_config['buffer_minutes']
        daily_cost = Decimal('0')

        # Pre-compute meal block times to skip (to avoid scheduling activities during meals)
        meal_blocks = []
        for meal_start_str, meal_dur in self.pace_config.get('meal_breaks', []):
            mh, mm = map(int, meal_start_str.split(':'))
            meal_start_min = mh * 60 + mm
            meal_end_min = meal_start_min + meal_dur
            meal_blocks.append((meal_start_min, meal_end_min))

        # Start from city center (approximate)
        prev_lat = None
        prev_lon = None

        # Take top candidates by score, filter used and invalid coordinates
        candidates = [p for p in available if p['place_id'] not in used
                      and p['place'].latitude and p['place'].longitude
                      and abs(p['place'].latitude) > 0.01 and abs(p['place'].longitude) > 0.01]

        order = 1
        selected_today = set()
        categories_used = []  # Track category variety

        while current_time < end_time and order <= max_activities and candidates:
            # Skip past any meal blocks
            for meal_start, meal_end in meal_blocks:
                if current_time >= meal_start and current_time < meal_end:
                    current_time = meal_end + 5  # small buffer after meal
                    break

            if current_time >= end_time:
                break

            # Find best next place considering distance + category variety
            best = None
            best_adjusted_score = -1
            best_travel_time = 0

            # Count how many times each category appears today
            cat_counts: Dict[str, int] = {}
            for c in categories_used:
                cat_counts[c] = cat_counts.get(c, 0) + 1

            for candidate in candidates:
                if candidate['place_id'] in selected_today:
                    continue

                place = candidate['place']

                # Check opening hours
                if place.opening_hour and self._minutes_to_time(current_time) < place.opening_hour:
                    continue
                if place.closing_hour and self._minutes_to_time(current_time) >= place.closing_hour:
                    continue

                # Check budget
                if daily_cost + place.avg_cost_usd > Decimal(str(self.daily_budget * 1.1)):
                    continue

                # Distance penalty from current position
                distance_factor = 1.0
                travel_minutes = 0
                if prev_lat is not None:
                    dist = self._haversine(prev_lat, prev_lon, place.latitude, place.longitude)
                    travel_minutes = self._estimate_travel_time(dist)
                    distance_factor = math.exp(-dist / 15.0)

                # Check if we have time (including potential meal after this)
                total_needed = travel_minutes + place.avg_duration_minutes + buffer
                if current_time + total_needed > end_time:
                    continue

                # Category diversity bonus: reduce score if category overused
                same_cat_count = cat_counts.get(place.category, 0)
                diversity_factor = 1.0 / (1.0 + same_cat_count * 0.4)

                adjusted_score = (
                    candidate['total_score'] * 0.55
                    + distance_factor * 0.30
                    + diversity_factor * 0.15
                )

                if adjusted_score > best_adjusted_score:
                    best = candidate
                    best_adjusted_score = adjusted_score
                    best_travel_time = travel_minutes

            if best is None:
                break

            place = best['place']
            start_minutes = current_time + (best_travel_time if prev_lat else 0)
            end_minutes = start_minutes + place.avg_duration_minutes

            items.append({
                'place_id': str(place.id),
                'day_number': day_number,
                'order': order,
                'start_time': self._minutes_to_time_str(start_minutes),
                'end_time': self._minutes_to_time_str(end_minutes),
                'duration_minutes': place.avg_duration_minutes,
                'travel_time_minutes': best_travel_time if prev_lat else 0,
                'estimated_cost_usd': float(place.avg_cost_usd),
                'score': best['total_score'],
            })

            selected_today.add(best['place_id'])
            categories_used.append(place.category)
            daily_cost += place.avg_cost_usd
            current_time = end_minutes + buffer
            prev_lat = place.latitude
            prev_lon = place.longitude
            order += 1

        return items

    @staticmethod
    def _haversine(lat1, lon1, lat2, lon2) -> float:
        R = 6371
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (math.sin(dlat / 2) ** 2 +
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
             math.sin(dlon / 2) ** 2)
        return R * 2 * math.asin(math.sqrt(a))

    @staticmethod
    def _estimate_travel_time(distance_km: float) -> int:
        """Estimate travel time in minutes using realistic speed tiers.
        
        < 2km: walking ~5 km/h
        2-8km: auto-rickshaw / taxi in city ~15 km/h (traffic)
        8-30km: city driving ~30 km/h
        30km+: highway / intercity ~60 km/h
        """
        if distance_km < 2:
            speed = 5.0
        elif distance_km < 8:
            speed = 15.0
        elif distance_km < 30:
            speed = 30.0
        else:
            speed = 60.0
        return max(3, int((distance_km / speed) * 60))

    @staticmethod
    def _minutes_to_time(minutes: int) -> dt_time:
        h = min(23, minutes // 60)
        m = minutes % 60
        return dt_time(h, m)

    @staticmethod
    def _minutes_to_time_str(minutes: int) -> str:
        h = min(23, minutes // 60)
        m = minutes % 60
        return f"{h:02d}:{m:02d}"
