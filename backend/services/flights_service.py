"""Flights service - search for flight options with Amadeus API + fallback."""
import json
import logging
import random
import re
import time
from datetime import datetime, timedelta
from decimal import Decimal
from requests import HTTPError
from django.conf import settings
from .base import BaseService

logger = logging.getLogger(__name__)

# IATA codes for cities (used by Amadeus API)
IATA_CODES = {
    'Delhi': 'DEL', 'Mumbai': 'BOM', 'Bangalore': 'BLR', 'Chennai': 'MAA',
    'Kolkata': 'CCU', 'Hyderabad': 'HYD', 'Goa': 'GOI', 'Jaipur': 'JAI',
    'Ahmedabad': 'AMD', 'Pune': 'PNQ', 'Kochi': 'COK', 'Coimbatore': 'CJB', 'Lucknow': 'LKO',
    'Paris': 'CDG', 'Tokyo': 'NRT', 'New York': 'JFK', 'London': 'LHR',
    'Dubai': 'DXB', 'Singapore': 'SIN', 'Bangkok': 'BKK', 'Sydney': 'SYD',
    'Los Angeles': 'LAX', 'Rome': 'FCO', 'Barcelona': 'BCN', 'Istanbul': 'IST',
    'Frankfurt': 'FRA', 'Doha': 'DOH', 'Hong Kong': 'HKG', 'Seoul': 'ICN',
    'Kuala Lumpur': 'KUL', 'Bali': 'DPS', 'Amsterdam': 'AMS', 'Zurich': 'ZRH',
    'Vienna': 'VIE', 'Osaka': 'KIX', 'Taipei': 'TPE', 'Manila': 'MNL',
    'Jakarta': 'CGK', 'Ho Chi Minh City': 'SGN', 'Hanoi': 'HAN',
    'Colombo': 'CMB', 'Kathmandu': 'KTM', 'Dhaka': 'DAC',
    'San Francisco': 'SFO', 'Chicago': 'ORD', 'Toronto': 'YYZ',
}

# Nearest practical airport for towns/cities without a direct major airport code
NEAREST_AIRPORT_CODES = {
    'Munnar': 'COK',
    'Ooty': 'CJB',
    'Kodaikanal': 'IXM',
    'Mysore': 'MYQ',
    'Pondicherry': 'PNY',
    'Alleppey': 'COK',
    'Thekkady': 'COK',
    'Wayanad': 'CCJ',
    'Thanjavur': 'TRZ',
    'Tanjore': 'TRZ',
}


class FlightsService(BaseService):
    """Flight search with real-time Amadeus API as primary source."""

    BASE_URL = 'https://test.api.amadeus.com'

    def __init__(self):
        super().__init__()
        self.api_key = getattr(settings, 'AMADEUS_API_KEY', '')
        self.api_secret = getattr(settings, 'AMADEUS_API_SECRET', '')
        self._access_token = None
        self._token_expires_at = 0.0
        self._llm = None

    @staticmethod
    def _match_city_code(city: str, code_map: dict) -> str | None:
        """Case-insensitive city lookup for IATA maps."""
        target = (city or '').strip().lower()
        if not target:
            return None
        for name, code in code_map.items():
            if str(name).strip().lower() == target:
                return code
        return None

    def _auth_headers(self, token: str | None) -> dict:
        cleaned = (token or '').strip()
        if not cleaned:
            return {}
        return {'Authorization': f'Bearer {cleaned}'}

    def _get_amadeus_token(self, force_refresh: bool = False) -> str | None:
        """Get Amadeus OAuth2 access token."""
        if not force_refresh and self._access_token and time.time() < self._token_expires_at:
            return self._access_token
        if not self.api_key or not self.api_secret:
            return None
        try:
            resp = self.session.post(
                f'{self.BASE_URL}/v1/security/oauth2/token',
                data={
                    'grant_type': 'client_credentials',
                    'client_id': self.api_key,
                    'client_secret': self.api_secret,
                },
                timeout=10,
            )
            resp.raise_for_status()
            payload = resp.json() or {}
            self._access_token = (payload.get('access_token') or '').strip() or None
            expires_in = int(payload.get('expires_in') or 1799)
            self._token_expires_at = time.time() + max(60, expires_in - 60)
            return self._access_token
        except Exception as e:
            self._access_token = None
            self._token_expires_at = 0.0
            logger.warning(f"Amadeus auth failed: {e}")
            return None

    def _get_iata(self, city: str) -> str:
        """Resolve city name to IATA code."""
        return IATA_CODES.get(city, city[:3].upper())

    def _resolve_airport_code(self, city: str, token: str | None = None) -> str:
        """Resolve best airport code using static map -> AI generation -> Amadeus validation/lookup."""
        city = (city or '').strip()
        if not city:
            return 'XXX'

        static_code = self._match_city_code(city, IATA_CODES)
        if static_code:
            return static_code
        nearest_code = self._match_city_code(city, NEAREST_AIRPORT_CODES)
        if nearest_code:
            return nearest_code

        # User-required behavior: generate nearest airport code via LLM first.
        llm_code = self._llm_airport_code(city)
        if llm_code:
            if token:
                validated = self._validate_iata_with_amadeus(llm_code, token)
                if validated:
                    return validated
            else:
                return llm_code

        # Fallback: ask Amadeus by city keyword, preferring AIRPORT subtype.
        if token:
            try:
                resp = self.session.get(
                    f'{self.BASE_URL}/v1/reference-data/locations',
                    params={
                        'subType': 'AIRPORT',
                        'keyword': city,
                        'page[limit]': 5,
                        'view': 'LIGHT',
                    },
                    headers=self._auth_headers(token),
                    timeout=12,
                )
                resp.raise_for_status()
                items = resp.json().get('data', [])
                for item in items:
                    code = item.get('iataCode')
                    if code and len(code) == 3:
                        return code

                # Secondary lookup: CITY/AIRPORT mixed, but still prefer AIRPORT records.
                resp = self.session.get(
                    f'{self.BASE_URL}/v1/reference-data/locations',
                    params={
                        'subType': 'AIRPORT,CITY',
                        'keyword': city,
                        'page[limit]': 8,
                        'view': 'LIGHT',
                    },
                    headers=self._auth_headers(token),
                    timeout=12,
                )
                resp.raise_for_status()
                mixed_items = resp.json().get('data', [])
                airport_first = [
                    x for x in mixed_items
                    if str(x.get('subType', '')).upper() == 'AIRPORT' and x.get('iataCode')
                ]
                for item in airport_first:
                    code = str(item.get('iataCode', '')).upper().strip()
                    if len(code) == 3 and code.isalpha():
                        return code
            except Exception as e:
                logger.debug(f'Amadeus airport lookup failed for {city}: {e}')

        return city[:3].upper()

    def _llm_airport_code(self, city: str) -> str | None:
        """Generate nearest practical airport IATA code via LLM."""
        try:
            llm = self._get_llm()
            system_prompt = (
                "Return only JSON object: {\"iata\":\"XXX\"}. "
                "Given a city/town, output the nearest practical commercial airport IATA code. "
                "No explanation, no markdown."
            )
            raw = llm._call_llm(system_prompt, f'City: {city}', max_tokens=80)
            match = re.search(r'\{.*\}', (raw or '').strip(), flags=re.DOTALL)
            if not match:
                return None
            obj = json.loads(match.group(0))
            iata = str(obj.get('iata', '')).upper().strip()
            if len(iata) == 3 and iata.isalpha():
                return iata
            return None
        except Exception:
            return None

    def _validate_iata_with_amadeus(self, code: str, token: str) -> str | None:
        """Validate an IATA code against Amadeus locations API, preferring airport codes."""
        try:
            resp = self.session.get(
                f'{self.BASE_URL}/v1/reference-data/locations',
                params={
                    'subType': 'AIRPORT',
                    'keyword': code,
                    'page[limit]': 3,
                    'view': 'LIGHT',
                },
                headers=self._auth_headers(token),
                timeout=10,
            )
            resp.raise_for_status()
            items = resp.json().get('data', [])
            for item in items:
                iata = str(item.get('iataCode', '')).upper().strip()
                subtype = str(item.get('subType', '')).upper().strip()
                if iata == code and subtype == 'AIRPORT':
                    return iata

            # Fallback: if airport-only query finds nothing, accept only explicit AIRPORT from mixed result.
            resp = self.session.get(
                f'{self.BASE_URL}/v1/reference-data/locations',
                params={
                    'subType': 'AIRPORT,CITY',
                    'keyword': code,
                    'page[limit]': 5,
                    'view': 'LIGHT',
                },
                headers=self._auth_headers(token),
                timeout=10,
            )
            resp.raise_for_status()
            items = resp.json().get('data', [])
            for item in items:
                iata = str(item.get('iataCode', '')).upper().strip()
                subtype = str(item.get('subType', '')).upper().strip()
                if iata == code and subtype == 'AIRPORT':
                    return iata
        except Exception:
            return None
        return None

    def search(self, departure: str, arrival: str, date) -> list:
        """Search flights. Returns list of dicts ready for TravelOption.objects.create()."""
        if isinstance(date, str):
            date_str = date
        else:
            date_str = date.strftime('%Y-%m-%d') if hasattr(date, 'strftime') else str(date)

        token = self._get_amadeus_token()
        if token:
            results = self._search_amadeus(departure, arrival, date_str, token)
            if results:
                return results

            if getattr(settings, 'AMADEUS_STRICT_ONLY', False):
                logger.warning('Amadeus strict mode enabled: skipping LLM fallback for flights')
                return []

        # Fallback only when API auth/search is unavailable.
        return self._llm_flights(departure, arrival, date_str)

    def _get_llm(self):
        """Lazy-load LLM layer."""
        if not hasattr(self, '_llm') or self._llm is None:
            from ai_engine.llm_layer import LLMLayer
            self._llm = LLMLayer()
        return self._llm

    @staticmethod
    def _extract_json_array(raw: str):
        """Extract first valid JSON array from possibly noisy LLM output."""
        text = (raw or '').strip()
        if not text:
            return None

        if text.startswith('```'):
            text = text.split('\n', 1)[1] if '\n' in text else text[3:]
            text = text.rsplit('```', 1)[0].strip()

        try:
            parsed = json.loads(text)
            return parsed if isinstance(parsed, list) else None
        except Exception:
            pass

        match = re.search(r'\[.*\]', text, flags=re.DOTALL)
        if not match:
            return None

        candidate = match.group(0).strip()
        try:
            parsed = json.loads(candidate)
            return parsed if isinstance(parsed, list) else None
        except Exception:
            return None

    def _llm_flights(self, departure: str, arrival: str, date_str: str) -> list:
        """Generate realistic flights using LLM when Amadeus is unavailable."""
        try:
            llm = self._get_llm()
            origin_code = self._resolve_airport_code(departure)
            destination_code = self._resolve_airport_code(arrival)
            if origin_code == destination_code:
                return []
            system_prompt = f"""You are a flight data API. Return realistic flight options from {departure} to {arrival}.
Use real-world knowledge of actual airlines operating this route, realistic pricing in INR, real airport codes, and accurate flight durations.
Return ONLY a JSON array with 3-5 flights. Each object:
{{"airline_name":"real airline","airline_code":"IATA code","flight_number":"code+number",
"departure_airport":"IATA","arrival_airport":"IATA","departure_hour":int,"departure_minute":int,
"duration_minutes":int,"price_inr":int,"stops":int,"stop_airports":["IATA"],"cabin_class":"Economy/Business/Premium Economy",
"amenities":["list"],"carbon_kg":float,"delay_risk":float}}"""

            user_prompt = f"Flights from {departure} to {arrival} on {date_str}"
            raw = llm._call_llm(system_prompt, user_prompt, max_tokens=1500)
            flights = self._extract_json_array(raw)
            if not isinstance(flights, list):
                logger.warning('Flight LLM fallback returned non-JSON array output')
                return self._heuristic_flights(departure, arrival, date_str, origin_code, destination_code)

            from datetime import date as dt_date
            travel_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            base_dt = datetime.combine(travel_date, datetime.min.time())
            options = []
            for f in flights:
                try:
                    dep_time = base_dt + timedelta(hours=int(f.get('departure_hour', 8)), minutes=int(f.get('departure_minute', 0)))
                    dur = max(45, min(1200, int(f.get('duration_minutes', 300))))
                    arr_time = dep_time + timedelta(minutes=dur)
                    raw_price = int(f.get('price_inr', 4500))
                    price_inr = Decimal(str(max(2500, min(250000, raw_price))))
                    options.append({
                        'transport_type': 'flight',
                        'provider_name': f.get('airline_name', 'Airline'),
                        'route_number': f.get('flight_number', f.get('airline_code', 'XX') + '000'),
                        'departure_city': departure,
                        'departure_station': origin_code,
                        'arrival_city': arrival,
                        'arrival_station': destination_code,
                        'departure_time': dep_time,
                        'arrival_time': arr_time,
                        'duration_minutes': dur,
                        'price_inr': price_inr,
                        'price_usd': round(price_inr / Decimal('83.5'), 2),
                        'stops': int(f.get('stops', 0)),
                        'stop_details': f.get('stop_airports', []),
                        'cabin_class': f.get('cabin_class', 'Economy'),
                        'carbon_kg': float(f.get('carbon_kg', round(dur * 0.15, 1))),
                        'delay_risk': min(1.0, float(f.get('delay_risk', 0.1))),
                        'amenities': f.get('amenities', ['Carry-on bag']),
                        'is_mock': True,
                    })
                except (ValueError, TypeError):
                    continue
            if options:
                return options
            return self._heuristic_flights(departure, arrival, date_str, origin_code, destination_code)
        except Exception as e:
            logger.warning(f"LLM flight fallback error: {e}")
            origin_code = self._resolve_airport_code(departure)
            destination_code = self._resolve_airport_code(arrival)
            return self._heuristic_flights(departure, arrival, date_str, origin_code, destination_code)

    def _heuristic_flights(self, departure: str, arrival: str, date_str: str, origin_code: str, destination_code: str) -> list:
        """Deterministic fallback flights when Amadeus and LLM JSON parsing fail."""
        try:
            travel_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except Exception:
            travel_date = datetime.utcnow().date()

        base_dt = datetime.combine(travel_date, datetime.min.time())
        templates = [
            {'provider': 'IndiGo', 'route': '6E401', 'hour': 7, 'minute': 20, 'dur': 80, 'price': 4299},
            {'provider': 'Air India', 'route': 'AI672', 'hour': 12, 'minute': 5, 'dur': 95, 'price': 5199},
            {'provider': 'Vistara', 'route': 'UK821', 'hour': 18, 'minute': 10, 'dur': 90, 'price': 5899},
        ]

        out = []
        for t in templates:
            dep_time = base_dt + timedelta(hours=t['hour'], minutes=t['minute'])
            arr_time = dep_time + timedelta(minutes=t['dur'])
            price_inr = Decimal(str(t['price']))
            out.append({
                'transport_type': 'flight',
                'provider_name': t['provider'],
                'route_number': t['route'],
                'departure_city': departure,
                'departure_station': origin_code,
                'arrival_city': arrival,
                'arrival_station': destination_code,
                'departure_time': dep_time,
                'arrival_time': arr_time,
                'duration_minutes': t['dur'],
                'price_inr': price_inr,
                'price_usd': round(price_inr / Decimal('83.5'), 2),
                'stops': 0,
                'stop_details': [],
                'cabin_class': 'Economy',
                'carbon_kg': round(t['dur'] * 0.15, 1),
                'delay_risk': 0.15,
                'amenities': ['Carry-on bag', 'In-flight entertainment'],
                'is_mock': True,
            })
        return out

    def _search_amadeus(self, departure: str, arrival: str, date_str: str, token: str) -> list:
        """Search via real Amadeus Flight Offers API."""
        try:
            origin = self._resolve_airport_code(departure, token)
            dest = self._resolve_airport_code(arrival, token)
            logger.info(f"Amadeus route resolution: {departure}->{origin}, {arrival}->{dest}")
            if origin == dest:
                return []

            # Recover from problematic city-like codes by forcing airport-only re-resolution.
            if token:
                safe_origin = self._resolve_airport_code(departure, token)
                safe_dest = self._resolve_airport_code(arrival, token)
                if safe_origin and safe_dest:
                    origin, dest = safe_origin, safe_dest

            attempt_params = [
                {
                    'originLocationCode': origin,
                    'destinationLocationCode': dest,
                    'departureDate': date_str,
                    'adults': 1,
                    'max': 6,
                    'currencyCode': 'INR',
                },
                {
                    'originLocationCode': origin,
                    'destinationLocationCode': dest,
                    'departureDate': date_str,
                    'adults': 1,
                    'max': 6,
                },
                {
                    'originLocationCode': origin,
                    'destinationLocationCode': dest,
                    'departureDate': date_str,
                    'adults': 1,
                    'max': 3,
                    'nonStop': 'false',
                },
            ]

            last_error = None
            for idx, params in enumerate(attempt_params, start=1):
                try:
                    resp = self.session.get(
                        f'{self.BASE_URL}/v2/shopping/flight-offers',
                        params=params,
                        headers=self._auth_headers(token),
                        timeout=15,
                    )

                    if resp.status_code == 401:
                        logger.warning('Amadeus auth token rejected (401); refreshing token and retrying once')
                        refreshed = self._get_amadeus_token(force_refresh=True)
                        if refreshed:
                            token = refreshed
                            resp = self.session.get(
                                f'{self.BASE_URL}/v2/shopping/flight-offers',
                                params=params,
                                headers=self._auth_headers(token),
                                timeout=15,
                            )

                    resp.raise_for_status()
                    data = resp.json()
                    parsed = self._parse_amadeus_response(data, departure, arrival)
                    if parsed:
                        return parsed
                except Exception as e:
                    last_error = e
                    logger.warning(f"Amadeus flight attempt {idx} failed: {e}")
                    if isinstance(e, HTTPError) and getattr(e, 'response', None) is not None:
                        status_code = e.response.status_code
                        try:
                            logger.warning(f"Amadeus response body: {e.response.text}")
                        except Exception:
                            pass

                        # Stop retrying immediately on hard rate limit.
                        if status_code == 429:
                            logger.warning('Amadeus rate-limited (429); stopping further retries')
                            break

                        # Sandbox internal error (38189) is typically non-recoverable for this request.
                        try:
                            payload = e.response.json() or {}
                            errors = payload.get('errors', [])
                            has_internal_38189 = any(str(err.get('code')) == '38189' for err in errors)
                            if has_internal_38189:
                                logger.warning('Amadeus internal error 38189; stopping further retries for this route/date')
                                break
                        except Exception:
                            pass

            # Final recovery: if all attempts failed, try one fresh code resolution pass and single request.
            if last_error and token:
                try:
                    refreshed_token = self._get_amadeus_token(force_refresh=True) or token
                    re_origin = self._resolve_airport_code(departure, refreshed_token)
                    re_dest = self._resolve_airport_code(arrival, refreshed_token)
                    if re_origin != origin or re_dest != dest:
                        logger.info(f"Amadeus route recovery resolution: {departure}->{re_origin}, {arrival}->{re_dest}")
                        resp = self.session.get(
                            f'{self.BASE_URL}/v2/shopping/flight-offers',
                            params={
                                'originLocationCode': re_origin,
                                'destinationLocationCode': re_dest,
                                'departureDate': date_str,
                                'adults': 1,
                                'max': 4,
                            },
                            headers=self._auth_headers(refreshed_token),
                            timeout=15,
                        )
                        resp.raise_for_status()
                        data = resp.json()
                        parsed = self._parse_amadeus_response(data, departure, arrival)
                        if parsed:
                            return parsed
                except Exception as recovery_error:
                    logger.warning(f"Amadeus recovery attempt failed: {recovery_error}")

            if last_error:
                raise last_error
            return []
        except Exception as e:
            logger.warning(f"Amadeus flight search failed: {e}")
            return []

    def _parse_amadeus_response(self, data: dict, departure: str, arrival: str) -> list:
        """Parse Amadeus API response into our standard format."""
        options = []
        for offer in data.get('data', []):
            try:
                seg = offer['itineraries'][0]['segments']
                first_seg = seg[0]
                last_seg = seg[-1]

                dep_time = datetime.fromisoformat(first_seg['departure']['at'])
                arr_time = datetime.fromisoformat(last_seg['arrival']['at'])
                duration_mins = int((arr_time - dep_time).total_seconds() / 60)

                price_inr = Decimal(offer['price']['total'])
                price_usd = round(price_inr / Decimal('83.5'), 2)

                stops = len(seg) - 1
                stop_details = [s['arrival']['iataCode'] for s in seg[:-1]] if stops > 0 else []
                carrier = first_seg.get('carrierCode', 'XX')
                flight_num = first_seg.get('number', '000')
                airline_name = self._carrier_to_name(carrier)
                cabin = offer.get('travelerPricings', [{}])[0].get('fareDetailsBySegment', [{}])[0].get('cabin', 'ECONOMY')

                options.append({
                    'transport_type': 'flight',
                    'provider_name': airline_name,
                    'route_number': f"{carrier}{flight_num}",
                    'departure_city': departure,
                    'departure_station': f"{first_seg['departure']['iataCode']}",
                    'arrival_city': arrival,
                    'arrival_station': f"{last_seg['arrival']['iataCode']}",
                    'departure_time': dep_time,
                    'arrival_time': arr_time,
                    'duration_minutes': duration_mins,
                    'price_inr': price_inr,
                    'price_usd': price_usd,
                    'stops': stops,
                    'stop_details': stop_details,
                    'cabin_class': cabin.title(),
                    'carbon_kg': round(duration_mins * 0.15, 1),
                    'delay_risk': round(random.uniform(0.05, 0.25), 2),
                    'amenities': self._random_amenities(cabin.title()),
                    'is_mock': False,
                })
            except (KeyError, IndexError, ValueError) as e:
                logger.debug(f"Skipping malformed flight offer: {e}")
                continue

        return options

    @staticmethod
    def _carrier_to_name(code: str) -> str:
        """Map carrier codes to airline names."""
        carrier_map = {
            'AI': 'Air India', '6E': 'IndiGo', 'SG': 'SpiceJet', 'UK': 'Vistara',
            'EK': 'Emirates', 'SQ': 'Singapore Airlines', 'BA': 'British Airways',
            'LH': 'Lufthansa', 'QR': 'Qatar Airways', 'TK': 'Turkish Airlines',
            'AF': 'Air France', 'KE': 'Korean Air', 'NH': 'ANA', 'JL': 'Japan Airlines',
            'CX': 'Cathay Pacific', 'QF': 'Qantas', 'DL': 'Delta', 'UA': 'United',
            'AA': 'American Airlines', 'LX': 'SWISS', 'EY': 'Etihad', 'WY': 'Oman Air',
        }
        return carrier_map.get(code, f'Airline {code}')

    def _random_amenities(self, cabin):
        base = ['Carry-on bag']
        if cabin in ('Premium Economy', 'Business'):
            base.extend(['Extra legroom', 'Priority boarding', 'Checked bag'])
        if cabin == 'Business':
            base.extend(['Lounge access', 'Lie-flat seat', 'Gourmet meals'])
        else:
            if random.random() > 0.5:
                base.append('In-flight entertainment')
            if random.random() > 0.6:
                base.append('Meal included')
        return base
