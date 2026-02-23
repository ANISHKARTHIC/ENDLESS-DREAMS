"""
Trains service — AI-powered train search using LLM for real-world knowledge.

Uses LLM to generate realistic train options based on actual operators,
routes, stations, pricing, and durations for any city pair worldwide.
"""
import json
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from django.conf import settings
from .base import BaseService

logger = logging.getLogger(__name__)

TRAIN_SEARCH_PROMPT = """You are a travel data API. Given two cities and a date, return realistic train options that actually exist or could realistically exist on that route.

Use your real-world knowledge of:
- Actual train operators for that region (e.g., Indian Railways, Eurostar, Shinkansen, TGV, Amtrak, Deutsche Bahn, Trenitalia, RENFE, etc.)
- Real station names for those cities
- Realistic journey durations based on actual distances
- Realistic pricing in INR (use current approximate conversion rates)
- Appropriate cabin classes for that operator
- Real route numbers or realistic format for that operator

Return ONLY a JSON array (no markdown, no explanation) with 2-4 train options. Each object must have:
{{
  "provider_name": "actual operator name",
  "route_number": "realistic train number",
  "departure_station": "real station name in {departure}",
  "arrival_station": "real station name in {arrival}",
  "departure_hour": hour (0-23),
  "departure_minute": minute (0-59),
  "duration_minutes": realistic duration in minutes,
  "price_inr": price in INR (integer),
  "cabin_class": "appropriate class for this operator",
  "stops": number of intermediate stops (integer),
  "amenities": ["list", "of", "amenities"],
  "carbon_kg": estimated CO2 in kg (float),
  "delay_risk": probability 0.0-0.3 (float)
}}

If no train service exists between these cities (e.g., across oceans), return an empty array [].
"""


class TrainsService(BaseService):
    """Train search using LLM for real-world accurate data."""

    BASE_URL = ''

    def __init__(self):
        super().__init__()
        self._llm = None

    def _get_llm(self):
        """Lazy-load LLM layer."""
        if self._llm is None:
            from ai_engine.llm_layer import LLMLayer
            self._llm = LLMLayer()
        return self._llm

    def search(self, departure: str, arrival: str, date) -> list:
        """Search train options using LLM-generated real-world data."""
        if isinstance(date, str):
            date = datetime.strptime(date, '%Y-%m-%d').date()

        try:
            llm = self._get_llm()
            user_prompt = (
                f"Find realistic train options from {departure} to {arrival} "
                f"on {date.strftime('%Y-%m-%d')} ({date.strftime('%A')}). "
                f"Use real operators, stations, and pricing for this specific route."
            )

            system_prompt = TRAIN_SEARCH_PROMPT.format(
                departure=departure, arrival=arrival
            )

            raw = llm._call_llm(system_prompt, user_prompt, max_tokens=1500)

            # Parse JSON from response
            raw = raw.strip()
            if raw.startswith('```'):
                raw = raw.split('\n', 1)[1] if '\n' in raw else raw[3:]
                raw = raw.rsplit('```', 1)[0]
            raw = raw.strip()

            trains_data = json.loads(raw)
            if not isinstance(trains_data, list):
                logger.warning("LLM returned non-list for trains")
                return []

            return self._format_options(trains_data, departure, arrival, date)

        except (json.JSONDecodeError, Exception) as e:
            logger.error(f"Train search LLM error: {e}")
            return []

    def _format_options(self, trains_data: list, departure: str, arrival: str, date) -> list:
        """Convert LLM response into TravelOption-compatible dicts."""
        base_dt = datetime.combine(date, datetime.min.time())
        options = []

        for t in trains_data:
            try:
                dep_hour = int(t.get('departure_hour', 8))
                dep_min = int(t.get('departure_minute', 0))
                dep_time = base_dt + timedelta(hours=dep_hour, minutes=dep_min)
                dur = int(t.get('duration_minutes', 300))
                arr_time = dep_time + timedelta(minutes=dur)
                price_inr = Decimal(str(int(t.get('price_inr', 2000))))
                price_usd = round(price_inr / Decimal('83.5'), 2)

                options.append({
                    'transport_type': 'train',
                    'provider_name': t.get('provider_name', 'Railway'),
                    'route_number': str(t.get('route_number', '')),
                    'departure_city': departure,
                    'departure_station': t.get('departure_station', f'{departure} Station'),
                    'arrival_city': arrival,
                    'arrival_station': t.get('arrival_station', f'{arrival} Station'),
                    'departure_time': dep_time,
                    'arrival_time': arr_time,
                    'duration_minutes': dur,
                    'price_inr': price_inr,
                    'price_usd': price_usd,
                    'stops': int(t.get('stops', 0)),
                    'stop_details': [],
                    'cabin_class': t.get('cabin_class', 'Standard'),
                    'carbon_kg': float(t.get('carbon_kg', round(dur * 0.02, 1))),
                    'delay_risk': min(1.0, float(t.get('delay_risk', 0.1))),
                    'amenities': t.get('amenities', ['Restroom']),
                    'is_mock': False,
                })
            except (ValueError, TypeError) as e:
                logger.warning(f"Skipping malformed train option: {e}")
                continue

        return options
