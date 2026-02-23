"""Flights service - search for flight options with Amadeus API + mock fallback."""
import logging
import random
from datetime import datetime, timedelta
from decimal import Decimal
from django.conf import settings
from .base import BaseService

logger = logging.getLogger(__name__)

# Mock airline data
AIRLINES = [
    {'name': 'Air India', 'code': 'AI', 'rating': 3.8},
    {'name': 'IndiGo', 'code': '6E', 'rating': 4.1},
    {'name': 'SpiceJet', 'code': 'SG', 'rating': 3.5},
    {'name': 'Vistara', 'code': 'UK', 'rating': 4.3},
    {'name': 'Emirates', 'code': 'EK', 'rating': 4.7},
    {'name': 'Singapore Airlines', 'code': 'SQ', 'rating': 4.8},
    {'name': 'British Airways', 'code': 'BA', 'rating': 4.2},
    {'name': 'Lufthansa', 'code': 'LH', 'rating': 4.4},
]

# IATA codes for cities
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

# Approximate flight durations in minutes between city pairs
FLIGHT_ROUTES = {
    ('Delhi', 'Paris'): {'duration': 540, 'base_price': 35000},
    ('Delhi', 'Tokyo'): {'duration': 510, 'base_price': 32000},
    ('Delhi', 'New York'): {'duration': 960, 'base_price': 55000},
    ('Delhi', 'London'): {'duration': 540, 'base_price': 34000},
    ('Mumbai', 'Paris'): {'duration': 570, 'base_price': 36000},
    ('Mumbai', 'Tokyo'): {'duration': 540, 'base_price': 33000},
    ('Mumbai', 'New York'): {'duration': 1020, 'base_price': 58000},
    ('Mumbai', 'London'): {'duration': 570, 'base_price': 35000},
    ('Bangalore', 'Paris'): {'duration': 600, 'base_price': 38000},
    ('Bangalore', 'Tokyo'): {'duration': 480, 'base_price': 30000},
    ('Bangalore', 'New York'): {'duration': 1080, 'base_price': 60000},
    ('Bangalore', 'London'): {'duration': 600, 'base_price': 37000},
    ('Chennai', 'Paris'): {'duration': 630, 'base_price': 39000},
    ('Chennai', 'Tokyo'): {'duration': 480, 'base_price': 31000},
    ('Chennai', 'New York'): {'duration': 1080, 'base_price': 59000},
    ('Chennai', 'London'): {'duration': 600, 'base_price': 37000},
    ('Kolkata', 'Paris'): {'duration': 600, 'base_price': 37000},
    ('Kolkata', 'Tokyo'): {'duration': 420, 'base_price': 28000},
    ('Kolkata', 'New York'): {'duration': 1020, 'base_price': 56000},
    ('Kolkata', 'London'): {'duration': 570, 'base_price': 36000},
    # Singapore routes
    ('Chennai', 'Singapore'): {'duration': 250, 'base_price': 15000},
    ('Delhi', 'Singapore'): {'duration': 330, 'base_price': 20000},
    ('Mumbai', 'Singapore'): {'duration': 330, 'base_price': 18000},
    ('Bangalore', 'Singapore'): {'duration': 240, 'base_price': 14000},
    ('Kolkata', 'Singapore'): {'duration': 260, 'base_price': 16000},
    # Dubai routes
    ('Chennai', 'Dubai'): {'duration': 240, 'base_price': 14000},
    ('Delhi', 'Dubai'): {'duration': 210, 'base_price': 13000},
    ('Mumbai', 'Dubai'): {'duration': 200, 'base_price': 12000},
    # Bangkok routes
    ('Chennai', 'Bangkok'): {'duration': 210, 'base_price': 12000},
    ('Delhi', 'Bangkok'): {'duration': 270, 'base_price': 15000},
    ('Mumbai', 'Bangkok'): {'duration': 260, 'base_price': 14000},
    # Other popular international routes
    ('Delhi', 'Sydney'): {'duration': 720, 'base_price': 50000},
    ('Mumbai', 'Sydney'): {'duration': 690, 'base_price': 48000},
    ('Delhi', 'Dubai'): {'duration': 210, 'base_price': 13000},
    ('Delhi', 'Istanbul'): {'duration': 420, 'base_price': 25000},
    ('Delhi', 'Rome'): {'duration': 540, 'base_price': 33000},
    ('Delhi', 'Barcelona'): {'duration': 570, 'base_price': 34000},
}

AIRPORTS = {
    'Delhi': 'Indira Gandhi Intl (DEL)',
    'Mumbai': 'Chhatrapati Shivaji Intl (BOM)',
    'Bangalore': 'Kempegowda Intl (BLR)',
    'Chennai': 'Chennai Intl (MAA)',
    'Kolkata': 'Netaji Subhas Chandra Bose Intl (CCU)',
    'Paris': 'Charles de Gaulle (CDG)',
    'Tokyo': 'Narita Intl (NRT)',
    'New York': 'John F. Kennedy Intl (JFK)',
    'London': 'Heathrow (LHR)',
    'Singapore': 'Changi Airport (SIN)',
    'Dubai': 'Dubai Intl (DXB)',
    'Bangkok': 'Suvarnabhumi (BKK)',
    'Sydney': 'Kingsford Smith (SYD)',
    'Los Angeles': 'LAX Intl (LAX)',
    'Rome': 'Fiumicino (FCO)',
    'Barcelona': 'El Prat (BCN)',
    'Istanbul': 'Istanbul Airport (IST)',
    'Hong Kong': 'Hong Kong Intl (HKG)',
    'Seoul': 'Incheon Intl (ICN)',
    'Kuala Lumpur': 'KLIA (KUL)',
    'Bali': 'Ngurah Rai (DPS)',
}


class FlightsService(BaseService):
    """Flight search with Amadeus API + mock fallback."""

    BASE_URL = 'https://test.api.amadeus.com'

    def __init__(self):
        super().__init__()
        self.api_key = getattr(settings, 'AMADEUS_API_KEY', '')
        self.api_secret = getattr(settings, 'AMADEUS_API_SECRET', '')
        self._access_token = None

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

        return self._mock_flights(departure, arrival, date_str)

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

    def _mock_flights(self, departure: str, arrival: str, date) -> list:
        """Generate realistic mock flight options."""
        route_key = (departure, arrival)
        reverse_key = (arrival, departure)

        route = FLIGHT_ROUTES.get(route_key) or FLIGHT_ROUTES.get(reverse_key)
        if not route:
            # Generate a generic route
            route = {'duration': 480, 'base_price': 35000}

        if isinstance(date, str):
            try:
                date = datetime.strptime(date, '%Y-%m-%d').date()
            except ValueError:
                date = datetime.now().date()

        base_dt = datetime.combine(date, datetime.min.time())
        options = []

        # Generate 4-6 flights
        num_flights = random.randint(4, 6)
        used_airlines = random.sample(AIRLINES, min(num_flights, len(AIRLINES)))

        departure_times = sorted([
            base_dt + timedelta(hours=random.choice([5, 6, 7, 8, 10, 12, 14, 16, 18, 21, 23]))
            for _ in range(num_flights)
        ])

        for i, airline in enumerate(used_airlines):
            dep_time = departure_times[i]
            dur = route['duration'] + random.randint(-40, 60)
            dur = max(dur, 120)
            arr_time = dep_time + timedelta(minutes=dur)

            # Price variation
            price_mult = random.uniform(0.7, 1.5)
            price_inr = Decimal(str(round(route['base_price'] * price_mult, -2)))
            price_usd = round(price_inr / Decimal('83.5'), 2)

            stops = random.choices([0, 1, 2], weights=[0.5, 0.35, 0.15])[0]
            stop_cities = []
            if stops > 0:
                stop_cities = random.sample(
                    ['Dubai', 'Singapore', 'Bangkok', 'Doha', 'Istanbul', 'Frankfurt'],
                    min(stops, 3),
                )
                dur += stops * random.randint(60, 150)
                arr_time = dep_time + timedelta(minutes=dur)

            # Carbon estimate: ~90g CO2/km/passenger for flights
            carbon = round(dur * 0.15, 1)  # rough approximation

            cabin = random.choice(['Economy', 'Economy', 'Economy', 'Premium Economy', 'Business'])
            if cabin == 'Business':
                price_inr = price_inr * Decimal('2.5')
                price_usd = round(price_inr / Decimal('83.5'), 2)

            options.append({
                'transport_type': 'flight',
                'provider_name': airline['name'],
                'route_number': f"{airline['code']}{random.randint(100, 999)}",
                'departure_city': departure,
                'departure_station': AIRPORTS.get(departure, f'{departure} Airport'),
                'arrival_city': arrival,
                'arrival_station': AIRPORTS.get(arrival, f'{arrival} Airport'),
                'departure_time': dep_time,
                'arrival_time': arr_time,
                'duration_minutes': dur,
                'price_inr': price_inr,
                'price_usd': price_usd,
                'stops': stops,
                'stop_details': stop_cities,
                'cabin_class': cabin,
                'carbon_kg': carbon,
                'delay_risk': round(random.uniform(0.05, 0.25), 2),
                'amenities': self._random_amenities(cabin),
                'is_mock': True,
            })

        return options

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
