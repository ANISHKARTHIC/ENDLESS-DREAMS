"""
Booking Insights Service — Price window detection and smart recommendations.

Analyzes travel and accommodation pricing to provide actionable booking advice:
- Best price windows (time-sensitive deals)
- Day-specific cost predictions
- Budget allocation recommendations
- Savings tips

Uses mock data when no external pricing API is configured.
"""
import random
import logging
from datetime import datetime, timedelta, date as dt_date
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


class BookingInsightsService:
    """Generates booking insights and price-window recommendations."""

    def generate_insights(
        self,
        city: str,
        start_date: dt_date,
        end_date: dt_date,
        budget_usd: float,
        accommodation_cost: float = 0,
        travel_cost: float = 0,
        num_activities: int = 0,
    ) -> Dict[str, Any]:
        """
        Generate comprehensive booking insights for a trip.

        Returns:
            Dict with 'price_alerts', 'daily_budget', 'savings_tips', 'booking_windows'
        """
        duration = (end_date - start_date).days + 1

        return {
            "price_alerts": self._generate_price_alerts(city, start_date, duration),
            "daily_budget": self._calculate_daily_budget(
                budget_usd, duration, accommodation_cost, travel_cost
            ),
            "savings_tips": self._generate_savings_tips(
                city, budget_usd, duration, accommodation_cost
            ),
            "booking_windows": self._detect_booking_windows(
                city, start_date, duration
            ),
            "cost_forecast": self._generate_cost_forecast(
                city, start_date, duration, budget_usd
            ),
            "is_mock": True,
        }

    def _generate_price_alerts(
        self, city: str, start_date: dt_date, duration: int
    ) -> List[Dict[str, Any]]:
        """Generate time-sensitive price alerts."""
        random.seed(hash(f"{city}{start_date}") % (2**32))
        alerts = []
        now = datetime.now()

        # Activity deal on a random day
        deal_day = random.randint(2, max(2, duration))
        discount = random.randint(15, 40)
        hours_left = random.randint(4, 24)
        alerts.append({
            "type": "activity_deal",
            "severity": "high" if discount > 25 else "medium",
            "title": f"Day {deal_day} activity — {discount}% off detected",
            "description": (
                f"Best price window detected for Day {deal_day} activity. "
                f"Booking recommended within next {hours_left} hours."
            ),
            "expires_in_hours": hours_left,
            "potential_savings_usd": round(random.uniform(8, 35), 2),
            "action": "Book Now",
        })

        # Early-bird accommodation
        days_until = (start_date - now.date()).days if start_date > now.date() else 0
        if days_until > 7:
            savings = random.randint(10, 25)
            alerts.append({
                "type": "accommodation_pricing",
                "severity": "medium",
                "title": f"Hotel prices may rise {savings}% closer to travel date",
                "description": (
                    f"Current rates for {city} are below the 30-day average. "
                    f"Booking now could save approximately ${random.randint(20, 80)} total."
                ),
                "expires_in_hours": days_until * 24,
                "potential_savings_usd": round(random.uniform(20, 80), 2),
                "action": "Lock Rate",
            })

        # Low crowd window
        low_crowd_day = random.randint(1, max(1, duration))
        alerts.append({
            "type": "crowd_insight",
            "severity": "low",
            "title": f"Day {low_crowd_day}: Low crowd window detected",
            "description": (
                f"Heritage sites on Day {low_crowd_day} have predicted low crowds "
                f"between 9:00-11:30 AM. Visit early for the best experience."
            ),
            "expires_in_hours": None,
            "potential_savings_usd": 0,
            "action": "View Schedule",
        })

        return alerts

    def _calculate_daily_budget(
        self,
        total_budget: float,
        duration: int,
        accommodation_cost: float,
        travel_cost: float,
    ) -> Dict[str, Any]:
        """Calculate recommended daily spending breakdown."""
        remaining = total_budget - accommodation_cost - travel_cost
        daily = remaining / max(1, duration)

        return {
            "total_budget_usd": total_budget,
            "accommodation_cost_usd": round(accommodation_cost, 2),
            "travel_cost_usd": round(travel_cost, 2),
            "remaining_for_activities_usd": round(remaining, 2),
            "daily_activity_budget_usd": round(daily, 2),
            "breakdown": {
                "meals": round(daily * 0.35, 2),
                "attractions": round(daily * 0.40, 2),
                "transport": round(daily * 0.15, 2),
                "miscellaneous": round(daily * 0.10, 2),
            },
        }

    def _generate_savings_tips(
        self,
        city: str,
        budget_usd: float,
        duration: int,
        accommodation_cost: float,
    ) -> List[Dict[str, str]]:
        """Generate city-specific savings tips."""
        random.seed(hash(city) % (2**32))

        base_tips = [
            {
                "category": "Accommodation",
                "tip": (
                    "Stay within 1.5 km of major attractions to reduce daily transport costs "
                    "by up to 35%. The AI selected your hotel for optimal proximity."
                ),
            },
            {
                "category": "Timing",
                "tip": (
                    "Visit popular sites during the first time slot (9:00-11:00 AM) "
                    "when crowds are lowest and ticket queues are shorter."
                ),
            },
            {
                "category": "Dining",
                "tip": (
                    f"Set lunch near your accommodation to reduce midday travel time. "
                    f"Budget meals in {city} average $8-15 per person."
                ),
            },
            {
                "category": "Booking",
                "tip": (
                    "Book attraction tickets online 2-3 days in advance for the "
                    "best prices. Last-minute walk-in rates are typically 15-25% higher."
                ),
            },
            {
                "category": "Transport",
                "tip": (
                    f"Consider a {duration}-day transit pass if available in {city}. "
                    f"Usually saves 40% over individual tickets for trips over 3 days."
                ),
            },
        ]

        # Add budget-specific tip
        daily = budget_usd / max(1, duration)
        if daily < 100:
            base_tips.append({
                "category": "Budget",
                "tip": (
                    "Your budget is tight — prioritize free attractions and "
                    "street food. Many world-class museums offer free entry windows."
                ),
            })

        return base_tips[:5]

    def _detect_booking_windows(
        self, city: str, start_date: dt_date, duration: int
    ) -> List[Dict[str, Any]]:
        """Detect optimal booking windows for each day's activities."""
        random.seed(hash(f"{city}{start_date}_windows") % (2**32))
        windows = []

        for day in range(1, duration + 1):
            day_date = start_date + timedelta(days=day - 1)
            current_price = round(random.uniform(15, 45), 2)
            trend = random.choice(["rising", "stable", "falling"])
            conf = random.randint(60, 95)

            windows.append({
                "day": day,
                "date": day_date.isoformat(),
                "avg_activity_cost_usd": current_price,
                "price_trend": trend,
                "confidence_pct": conf,
                "recommendation": (
                    "Book now — prices rising"
                    if trend == "rising"
                    else "Prices stable — safe to wait"
                    if trend == "stable"
                    else "Prices dropping — consider waiting 24h"
                ),
            })

        return windows

    def _generate_cost_forecast(
        self, city: str, start_date: dt_date, duration: int, budget_usd: float
    ) -> List[Dict[str, Any]]:
        """Generate a per-day cost forecast for the trip."""
        random.seed(hash(f"{city}{start_date}_forecast") % (2**32))
        daily_budget = budget_usd / max(1, duration)
        forecast = []
        cumulative = 0

        for day in range(1, duration + 1):
            # Some variation per day
            factor = 0.7 + random.random() * 0.6  # 70%-130% of daily avg
            predicted = round(daily_budget * factor, 2)
            cumulative += predicted
            forecast.append({
                "day": day,
                "predicted_cost_usd": predicted,
                "cumulative_usd": round(cumulative, 2),
                "budget_remaining_usd": round(budget_usd - cumulative, 2),
                "on_track": cumulative <= (daily_budget * day * 1.1),
            })

        return forecast
