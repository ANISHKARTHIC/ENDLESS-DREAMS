"""
Trains service — real-time train API with resilient fallback.

Primary source: external train API (configurable via environment variables).
Fallback source: LLM-generated realistic options if API is unavailable.
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
    """Train search using real API first, then fallback."""

    BASE_URL = ''

    def __init__(self):
        super().__init__()
        self._llm = None
        self.api_base_url = getattr(settings, 'TRAIN_API_BASE_URL', '').rstrip('/')
        self.api_path = getattr(settings, 'TRAIN_API_PATH', '').strip() or '/search'
        self.api_key = getattr(settings, 'TRAIN_API_KEY', '')
        self.api_host = getattr(settings, 'TRAIN_API_HOST', '')
        self.api_timeout = int(getattr(settings, 'TRAIN_API_TIMEOUT', 12) or 12)

    def _api_headers(self) -> dict:
        headers = {
            'Accept': 'application/json',
        }
        if self.api_key:
            headers['Authorization'] = f'Bearer {self.api_key}'
            headers['X-API-Key'] = self.api_key
            headers['apikey'] = self.api_key
            headers['x-rapidapi-key'] = self.api_key
        if self.api_host:
            headers['x-rapidapi-host'] = self.api_host
        return headers

    def _search_train_api(self, departure: str, arrival: str, date_str: str) -> list:
        """Search real-time train options from configured external API."""
        if not self.api_base_url:
            return []

        url = f"{self.api_base_url}{self.api_path if self.api_path.startswith('/') else '/' + self.api_path}"
        params = {
            'from': departure,
            'to': arrival,
            'date': date_str,
            'source': departure,
            'destination': arrival,
            'departure_city': departure,
            'arrival_city': arrival,
            'journey_date': date_str,
        }

        try:
            # Try GET first (common for search APIs)
            response = self.session.get(
                url,
                params=params,
                headers=self._api_headers(),
                timeout=self.api_timeout,
            )
            if response.status_code == 405:
                # If provider expects POST, retry once
                response = self.session.post(
                    url,
                    json={
                        'from': departure,
                        'to': arrival,
                        'date': date_str,
                        'source': departure,
                        'destination': arrival,
                        'departure_city': departure,
                        'arrival_city': arrival,
                        'journey_date': date_str,
                    },
                    headers=self._api_headers(),
                    timeout=self.api_timeout,
                )

            response.raise_for_status()
            payload = response.json()
            return self._parse_api_response(payload, departure, arrival, date_str)
        except Exception as e:
            logger.warning(f"Train API search failed: {e}")
            return []

    def _parse_api_response(self, payload: dict | list, departure: str, arrival: str, date_str: str) -> list:
        """Normalize heterogeneous train API payloads into TravelOption-compatible dicts."""
        date = datetime.strptime(date_str, '%Y-%m-%d').date()
        base_dt = datetime.combine(date, datetime.min.time())

        candidates = []
        if isinstance(payload, list):
            candidates = payload
        elif isinstance(payload, dict):
            for key in ('data', 'results', 'trains', 'options'):
                val = payload.get(key)
                if isinstance(val, list):
                    candidates = val
                    break
            if not candidates and all(k in payload for k in ('provider_name', 'departure_hour')):
                candidates = [payload]

        options = []
        for t in candidates:
            if not isinstance(t, dict):
                continue
            try:
                dep_time_raw = t.get('departure_time') or t.get('dep_time') or t.get('departure')
                arr_time_raw = t.get('arrival_time') or t.get('arr_time') or t.get('arrival')

                if isinstance(dep_time_raw, str) and ':' in dep_time_raw:
                    h, m = dep_time_raw.split(':', 1)
                    dep_hour, dep_minute = int(h), int(m)
                else:
                    dep_hour = int(t.get('departure_hour', 8))
                    dep_minute = int(t.get('departure_minute', 0))

                dep_time = base_dt + timedelta(hours=dep_hour, minutes=dep_minute)

                duration = t.get('duration_minutes')
                if duration is None:
                    if isinstance(arr_time_raw, str) and ':' in arr_time_raw:
                        ah, am = arr_time_raw.split(':', 1)
                        arr_time = base_dt + timedelta(hours=int(ah), minutes=int(am))
                        if arr_time < dep_time:
                            arr_time += timedelta(days=1)
                        duration = int((arr_time - dep_time).total_seconds() / 60)
                    else:
                        duration = int(t.get('duration', 300))
                duration = max(30, int(duration))
                arr_time = dep_time + timedelta(minutes=duration)

                price_val = (
                    t.get('price_inr')
                    or t.get('price')
                    or t.get('fare')
                    or t.get('amount')
                    or 2000
                )
                price_inr = Decimal(str(price_val))
                price_usd = round(price_inr / Decimal('83.5'), 2)

                provider_name = (
                    t.get('provider_name')
                    or t.get('operator')
                    or t.get('train_operator')
                    or 'Railway'
                )
                route_number = str(
                    t.get('route_number')
                    or t.get('train_number')
                    or t.get('train_no')
                    or t.get('number')
                    or ''
                )

                dep_station = (
                    t.get('departure_station')
                    or t.get('source_station_name')
                    or t.get('source')
                    or f'{departure} Station'
                )
                arr_station = (
                    t.get('arrival_station')
                    or t.get('destination_station_name')
                    or t.get('destination')
                    or f'{arrival} Station'
                )

                stops = int(t.get('stops', t.get('intermediate_stops', 0)) or 0)
                amenities = t.get('amenities') if isinstance(t.get('amenities'), list) else ['Restroom']

                options.append({
                    'transport_type': 'train',
                    'provider_name': provider_name,
                    'route_number': route_number,
                    'departure_city': departure,
                    'departure_station': dep_station,
                    'arrival_city': arrival,
                    'arrival_station': arr_station,
                    'departure_time': dep_time,
                    'arrival_time': arr_time,
                    'duration_minutes': duration,
                    'price_inr': price_inr,
                    'price_usd': price_usd,
                    'stops': stops,
                    'stop_details': t.get('stop_details', []),
                    'cabin_class': t.get('cabin_class', t.get('class', 'Standard')),
                    'carbon_kg': float(t.get('carbon_kg', round(duration * 0.02, 1))),
                    'delay_risk': min(1.0, float(t.get('delay_risk', 0.1))),
                    'amenities': amenities,
                    'is_mock': False,
                })
            except (ValueError, TypeError, ArithmeticError) as e:
                logger.debug(f"Skipping malformed train API option: {e}")
                continue

        return options

    def _get_llm(self):
        """Lazy-load LLM layer."""
        if self._llm is None:
            from ai_engine.llm_layer import LLMLayer
            self._llm = LLMLayer()
        return self._llm

    def search(self, departure: str, arrival: str, date) -> list:
        """Search train options using real-time API first, fallback to LLM."""
        if isinstance(date, str):
            date = datetime.strptime(date, '%Y-%m-%d').date()

        date_str = date.strftime('%Y-%m-%d')

        # Primary source: external train API
        api_results = self._search_train_api(departure, arrival, date_str)
        if api_results:
            return api_results

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
                    'is_mock': True,
                })
            except (ValueError, TypeError) as e:
                logger.warning(f"Skipping malformed train option: {e}")
                continue

        return options
