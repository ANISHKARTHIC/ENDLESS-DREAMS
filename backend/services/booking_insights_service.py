"""
Booking Insights Service — AI-powered price insights and recommendations.

Uses LLM to generate city-specific, context-aware booking insights:
- Best price windows (time-sensitive advice)
- Day-specific cost predictions based on real-world knowledge
- Budget allocation recommendations
- City-specific savings tips
"""
import json
import logging
from datetime import datetime, timedelta, date as dt_date
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

INSIGHTS_PROMPT = """You are a travel budget advisor with deep knowledge of travel costs worldwide.
Given a trip to {city} from {start_date} to {end_date} with a budget of ${budget_usd} USD, generate actionable booking insights.

Consider:
- Real-world pricing for {city} (accommodation, food, transport, attractions)
- Seasonal pricing trends for the travel dates
- Known free/cheap days at popular attractions
- Local transport passes and deals
- Typical crowd patterns

Return ONLY valid JSON (no markdown) with this structure:
{{
  "price_alerts": [
    {{
      "type": "activity_deal|accommodation_pricing|crowd_insight|transport_deal",
      "severity": "high|medium|low",
      "title": "concise alert title",
      "description": "actionable description specific to {city}",
      "potential_savings_usd": number,
      "action": "Book Now|Lock Rate|View Schedule|Compare"
    }}
  ],
  "savings_tips": [
    {{
      "category": "Accommodation|Dining|Transport|Timing|Booking|Budget",
      "tip": "specific tip for {city} with real details"
    }}
  ],
  "daily_activity_cost_usd": estimated average daily activity spend in {city},
  "food_cost_per_day_usd": estimated daily food cost in {city}
}}

Provide 2-3 price alerts and 4-5 savings tips. Be specific to {city} — mention real places, transit systems, and local knowledge.
"""


class BookingInsightsService:
    """Generates AI-powered booking insights and recommendations."""

    def __init__(self):
        self._llm = None

    def _get_llm(self):
        """Lazy-load LLM layer."""
        if self._llm is None:
            from ai_engine.llm_layer import LLMLayer
            self._llm = LLMLayer()
        return self._llm

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
        """Generate comprehensive booking insights for a trip."""
        duration = (end_date - start_date).days + 1

        # Try LLM-powered insights first
        llm_insights = self._get_llm_insights(city, start_date, end_date, budget_usd)

        # Calculate daily budget breakdown
        daily_budget = self._calculate_daily_budget(
            budget_usd, duration, accommodation_cost, travel_cost
        )

        # Generate cost forecast using LLM's cost estimates
        daily_activity_cost = llm_insights.get('daily_activity_cost_usd', daily_budget['daily_activity_budget_usd'])
        food_cost = llm_insights.get('food_cost_per_day_usd', daily_budget['breakdown']['meals'])

        cost_forecast = self._generate_cost_forecast(
            start_date, duration, budget_usd, accommodation_cost,
            travel_cost, daily_activity_cost, food_cost
        )

        return {
            "price_alerts": llm_insights.get('price_alerts', []),
            "daily_budget": daily_budget,
            "savings_tips": llm_insights.get('savings_tips', []),
            "booking_windows": self._generate_booking_windows(start_date, duration, daily_activity_cost),
            "cost_forecast": cost_forecast,
            "is_mock": False,
        }

    def _get_llm_insights(self, city: str, start_date, end_date, budget_usd: float) -> dict:
        """Get city-specific insights from LLM."""
        try:
            llm = self._get_llm()
            system_prompt = INSIGHTS_PROMPT.format(
                city=city,
                start_date=start_date.isoformat(),
                end_date=end_date.isoformat(),
                budget_usd=budget_usd,
            )
            user_prompt = (
                f"Generate booking insights for a trip to {city} "
                f"from {start_date} to {end_date} with ${budget_usd} total budget."
            )
            raw = llm._call_llm(system_prompt, user_prompt, max_tokens=1200)

            # Clean markdown wrapping
            raw = raw.strip()
            if raw.startswith('```'):
                raw = raw.split('\n', 1)[1] if '\n' in raw else raw[3:]
                raw = raw.rsplit('```', 1)[0]
            raw = raw.strip()

            return json.loads(raw)

        except Exception as e:
            logger.error(f"LLM insights error: {e}")
            return self._fallback_insights(city, budget_usd)

    def _fallback_insights(self, city: str, budget_usd: float) -> dict:
        """Basic insights when LLM is unavailable."""
        return {
            "price_alerts": [{
                "type": "accommodation_pricing",
                "severity": "medium",
                "title": f"Book {city} accommodation early for best rates",
                "description": f"Prices in {city} tend to increase closer to travel dates. Book now to lock in current rates.",
                "potential_savings_usd": round(budget_usd * 0.1, 2),
                "action": "Lock Rate",
            }],
            "savings_tips": [
                {"category": "Booking", "tip": "Book attraction tickets online 2-3 days in advance for 15-25% savings vs walk-in prices."},
                {"category": "Transport", "tip": f"Check if {city} offers multi-day transit passes for significant savings on local transport."},
                {"category": "Dining", "tip": f"Explore local markets and street food in {city} for authentic meals at a fraction of restaurant prices."},
                {"category": "Timing", "tip": "Visit popular attractions during early morning hours (before 10 AM) for shorter queues."},
            ],
            "daily_activity_cost_usd": round(budget_usd * 0.15, 2),
            "food_cost_per_day_usd": round(budget_usd * 0.08, 2),
        }

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

    def _generate_booking_windows(
        self, start_date: dt_date, duration: int, daily_cost: float
    ) -> List[Dict[str, Any]]:
        """Generate booking windows based on day-of-week patterns."""
        windows = []
        for day in range(1, duration + 1):
            day_date = start_date + timedelta(days=day - 1)
            weekday = day_date.weekday()

            # Weekends tend to be pricier for activities
            if weekday >= 5:  # Saturday/Sunday
                trend = "rising"
                cost_mult = 1.15
                rec = "Book weekend activities in advance — prices tend to be higher"
            elif weekday == 0:  # Monday
                trend = "falling"
                cost_mult = 0.85
                rec = "Mondays often have deals — many museums offer discounts"
            else:
                trend = "stable"
                cost_mult = 1.0
                rec = "Standard weekday pricing — safe to book anytime"

            windows.append({
                "day": day,
                "date": day_date.isoformat(),
                "avg_activity_cost_usd": round(daily_cost * cost_mult, 2),
                "price_trend": trend,
                "confidence_pct": 75,
                "recommendation": rec,
            })
        return windows

    def _generate_cost_forecast(
        self, start_date: dt_date, duration: int, budget_usd: float,
        accommodation_cost: float, travel_cost: float,
        daily_activity_cost: float, food_cost: float,
    ) -> List[Dict[str, Any]]:
        """Generate a per-day cost forecast."""
        accommodation_daily = accommodation_cost / max(1, duration)
        forecast = []
        cumulative = travel_cost  # Travel cost is upfront

        for day in range(1, duration + 1):
            day_date = start_date + timedelta(days=day - 1)
            weekday = day_date.weekday()

            # Weekend premium
            mult = 1.15 if weekday >= 5 else 1.0
            predicted = round(
                (accommodation_daily + daily_activity_cost * mult + food_cost) , 2
            )
            cumulative += predicted

            forecast.append({
                "day": day,
                "predicted_cost_usd": predicted,
                "cumulative_usd": round(cumulative, 2),
                "budget_remaining_usd": round(budget_usd - cumulative, 2),
                "on_track": cumulative <= (budget_usd * day / duration * 1.1),
            })

        return forecast
