"""Flights service - search for flight options with Amadeus API + fallback."""
import json
import logging
import random
from datetime import datetime, timedelta
from decimal import Decimal
from django.conf import settings
from .base import BaseService

logger = logging.getLogger(__name__)

# IATA codes for cities (used by Amadeus API)
IATA_CODES = {
    'Delhi': 'DEL', 'Mumbai': 'BOM', 'Bangalore': 'BLR', 'Chennai': 'MAA',
    'Kolkata': 'CCU', 'Hyderabad': 'HYD', 'Goa': 'GOI', 'Jaipur': 'JAI',
    'Ahmedabad': 'AMD', 'Pune': 'PNQ', 'Kochi': 'COK', 'Lucknow': 'LKO',
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


class FlightsService(BaseService):
    """Flight search with real-time Amadeus API as primary source."""

    BASE_URL = 'https://test.api.amadeus.com'

    def __init__(self):
        super().__init__()
        self.api_key = getattr(settings, 'AMADEUS_API_KEY', '')
        self.api_secret = getattr(settings, 'AMADEUS_API_SECRET', '')
        self._access_token = None
        self._llm = None

    def _get_amadeus_token(self) -> str | None:
        """Get Amadeus OAuth2 access token."""
        if self._access_token:
            return self._access_token
        if not self.api_key:
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
            self._access_token = resp.json().get('access_token')
            return self._access_token
        except Exception as e:
            logger.warning(f"Amadeus auth failed: {e}")
            return None

    def _get_iata(self, city: str) -> str:
        """Resolve city name to IATA code."""
        return IATA_CODES.get(city, city[:3].upper())

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

        # Fallback only when API auth/search is unavailable.
        return self._llm_flights(departure, arrival, date_str)

    def _get_llm(self):
        """Lazy-load LLM layer."""
        if not hasattr(self, '_llm') or self._llm is None:
            from ai_engine.llm_layer import LLMLayer
            self._llm = LLMLayer()
        return self._llm

    def _llm_flights(self, departure: str, arrival: str, date_str: str) -> list:
        """Generate realistic flights using LLM when Amadeus is unavailable."""
        try:
            llm = self._get_llm()
            system_prompt = f"""You are a flight data API. Return realistic flight options from {departure} to {arrival}.
Use real-world knowledge of actual airlines operating this route, realistic pricing in INR, real airport codes, and accurate flight durations.
Return ONLY a JSON array with 3-5 flights. Each object:
{{"airline_name":"real airline","airline_code":"IATA code","flight_number":"code+number",
"departure_airport":"IATA","arrival_airport":"IATA","departure_hour":int,"departure_minute":int,
"duration_minutes":int,"price_inr":int,"stops":int,"stop_airports":["IATA"],"cabin_class":"Economy/Business/Premium Economy",
"amenities":["list"],"carbon_kg":float,"delay_risk":float}}"""

            user_prompt = f"Flights from {departure} to {arrival} on {date_str}"
            raw = llm._call_llm(system_prompt, user_prompt, max_tokens=1500)
            raw = raw.strip()
            if raw.startswith('```'):
                raw = raw.split('\n', 1)[1] if '\n' in raw else raw[3:]
                raw = raw.rsplit('```', 1)[0]

            flights = json.loads(raw.strip())
            if not isinstance(flights, list):
                return []

            from datetime import date as dt_date
            travel_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            base_dt = datetime.combine(travel_date, datetime.min.time())
            options = []
            for f in flights:
                try:
                    dep_time = base_dt + timedelta(hours=int(f.get('departure_hour', 8)), minutes=int(f.get('departure_minute', 0)))
                    dur = int(f.get('duration_minutes', 300))
                    arr_time = dep_time + timedelta(minutes=dur)
                    price_inr = Decimal(str(int(f.get('price_inr', 25000))))
                    options.append({
                        'transport_type': 'flight',
                        'provider_name': f.get('airline_name', 'Airline'),
                        'route_number': f.get('flight_number', f.get('airline_code', 'XX') + '000'),
                        'departure_city': departure,
                        'departure_station': f.get('departure_airport', self._get_iata(departure)),
                        'arrival_city': arrival,
                        'arrival_station': f.get('arrival_airport', self._get_iata(arrival)),
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
            return options
        except Exception as e:
            logger.error(f"LLM flight fallback error: {e}")
            return []

    def _search_amadeus(self, departure: str, arrival: str, date_str: str, token: str) -> list:
        """Search via real Amadeus Flight Offers API."""
        try:
            origin = self._get_iata(departure)
            dest = self._get_iata(arrival)
            resp = self.session.get(
                f'{self.BASE_URL}/v2/shopping/flight-offers',
                params={
                    'originLocationCode': origin,
                    'destinationLocationCode': dest,
                    'departureDate': date_str,
                    'adults': 1,
                    'max': 6,
                    'currencyCode': 'INR',
                },
                headers={'Authorization': f'Bearer {token}'},
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            return self._parse_amadeus_response(data, departure, arrival)
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
