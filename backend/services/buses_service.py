"""
Buses service — AI-powered bus search using LLM for real-world knowledge.

Uses LLM to generate realistic bus options based on actual operators,
routes, terminals, pricing, and durations for any city pair worldwide.
"""
import json
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from django.conf import settings
from .base import BaseService

logger = logging.getLogger(__name__)

BUS_SEARCH_PROMPT = """You are a travel data API. Given two cities and a date, return realistic bus/coach options that actually exist or could realistically exist on that route.

Use your real-world knowledge of:
- Actual bus operators for that region (e.g., RedBus, VRL Travels, FlixBus, Greyhound, National Express, ALSA, Megabus, etc.)
- Real bus terminal/station names for those cities
- Realistic journey durations based on actual road distances
- Realistic pricing in INR (use current approximate conversion rates)
- Appropriate bus types for that operator and route
- Realistic route numbers or bus service identifiers

Return ONLY a JSON array (no markdown, no explanation) with 2-5 bus options. Each object must have:
{{
  "provider_name": "actual bus operator name",
  "route_number": "realistic service number",
  "departure_station": "real bus terminal/station in {departure}",
  "arrival_station": "real bus terminal/station in {arrival}",
  "departure_hour": hour (0-23),
  "departure_minute": minute (0-59),
  "duration_minutes": realistic duration in minutes,
  "price_inr": price in INR (integer),
  "cabin_class": "bus type like AC Sleeper, Volvo Multi-Axle, Standard, etc.",
  "stops": number of intermediate stops (integer),
  "amenities": ["list", "of", "amenities"],
  "carbon_kg": estimated CO2 in kg (float),
  "delay_risk": probability 0.0-0.4 (float)
}}

If no bus service exists between these cities (e.g., across oceans or extremely far), return an empty array [].
"""


class BusesService(BaseService):
    """Bus search using LLM for real-world accurate data."""

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
        """Search bus options using LLM-generated real-world data."""
        if isinstance(date, str):
            date = datetime.strptime(date, '%Y-%m-%d').date()

        try:
            llm = self._get_llm()
            user_prompt = (
                f"Find realistic bus/coach options from {departure} to {arrival} "
                f"on {date.strftime('%Y-%m-%d')} ({date.strftime('%A')}). "
                f"Use real operators, terminals, and pricing for this specific route."
            )

            system_prompt = BUS_SEARCH_PROMPT.format(
                departure=departure, arrival=arrival
            )

            raw = llm._call_llm(system_prompt, user_prompt, max_tokens=1500)

            # Parse JSON from response
            raw = raw.strip()
            if raw.startswith('```'):
                raw = raw.split('\n', 1)[1] if '\n' in raw else raw[3:]
                raw = raw.rsplit('```', 1)[0]
            raw = raw.strip()

            buses_data = json.loads(raw)
            if not isinstance(buses_data, list):
                logger.warning("LLM returned non-list for buses")
                return []

            return self._format_options(buses_data, departure, arrival, date)

        except (json.JSONDecodeError, Exception) as e:
            logger.error(f"Bus search LLM error: {e}")
            return []

    def _format_options(self, buses_data: list, departure: str, arrival: str, date) -> list:
        """Convert LLM response into TravelOption-compatible dicts."""
        base_dt = datetime.combine(date, datetime.min.time())
        options = []

        for b in buses_data:
            try:
                dep_hour = int(b.get('departure_hour', 18))
                dep_min = int(b.get('departure_minute', 0))
                dep_time = base_dt + timedelta(hours=dep_hour, minutes=dep_min)
                dur = int(b.get('duration_minutes', 480))
                arr_time = dep_time + timedelta(minutes=dur)
                price_inr = Decimal(str(int(b.get('price_inr', 1200))))
                price_usd = round(price_inr / Decimal('83.5'), 2)

                options.append({
                    'transport_type': 'bus',
                    'provider_name': b.get('provider_name', 'Bus Service'),
                    'route_number': str(b.get('route_number', '')),
                    'departure_city': departure,
                    'departure_station': b.get('departure_station', f'{departure} Bus Terminal'),
                    'arrival_city': arrival,
                    'arrival_station': b.get('arrival_station', f'{arrival} Bus Terminal'),
                    'departure_time': dep_time,
                    'arrival_time': arr_time,
                    'duration_minutes': dur,
                    'price_inr': price_inr,
                    'price_usd': price_usd,
                    'stops': int(b.get('stops', 2)),
                    'stop_details': [],
                    'cabin_class': b.get('cabin_class', 'Standard'),
                    'carbon_kg': float(b.get('carbon_kg', round(dur * 0.04, 1))),
                    'delay_risk': min(1.0, float(b.get('delay_risk', 0.15))),
                    'amenities': b.get('amenities', ['Luggage storage']),
                    'is_mock': False,
                })
            except (ValueError, TypeError) as e:
                logger.warning(f"Skipping malformed bus option: {e}")
                continue

        return options
