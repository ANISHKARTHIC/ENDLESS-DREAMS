"""Flights service - search for flight options with mock fallback."""
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
}


class FlightsService(BaseService):
    """Flight search with API + mock fallback."""

    BASE_URL = 'https://test.api.amadeus.com/v2'

    def __init__(self):
        super().__init__()
        self.api_key = getattr(settings, 'AMADEUS_API_KEY', '')

    def search(self, departure: str, arrival: str, date) -> list:
        """Search flights. Returns list of dicts ready for TravelOption.objects.create()."""
        if not self.api_key:
            return self._mock_flights(departure, arrival, date)

        # Real API call would go here
        return self._mock_flights(departure, arrival, date)

    def _mock_flights(self, departure: str, arrival: str, date) -> list:
        """Generate realistic mock flight options."""
        route_key = (departure, arrival)
        reverse_key = (arrival, departure)

        route = FLIGHT_ROUTES.get(route_key) or FLIGHT_ROUTES.get(reverse_key)
        if not route:
            # Generate a generic route
            route = {'duration': 480, 'base_price': 35000}

        if isinstance(date, str):
            date = datetime.strptime(date, '%Y-%m-%d').date()

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
