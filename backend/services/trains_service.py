"""Trains service - search for train options with mock fallback."""
import logging
import random
from datetime import datetime, timedelta
from decimal import Decimal
from django.conf import settings
from .base import BaseService

logger = logging.getLogger(__name__)

# Indian trains data (domestic legs, or international high-speed concepts)
TRAIN_OPERATORS = [
    {'name': 'Indian Railways (Rajdhani)', 'code': 'RAJD', 'rating': 4.0},
    {'name': 'Indian Railways (Shatabdi)', 'code': 'SHTB', 'rating': 4.1},
    {'name': 'Indian Railways (Duronto)', 'code': 'DRNT', 'rating': 3.8},
    {'name': 'Vande Bharat Express', 'code': 'VB', 'rating': 4.5},
    {'name': 'Eurostar', 'code': 'ES', 'rating': 4.6},
    {'name': 'Shinkansen', 'code': 'JR', 'rating': 4.9},
    {'name': 'TGV', 'code': 'TGV', 'rating': 4.5},
    {'name': 'Amtrak Acela', 'code': 'ACL', 'rating': 3.9},
]

# Domestic Indian routes (connect to international departure)
DOMESTIC_ROUTES = {
    ('Delhi', 'Mumbai'): {'duration': 960, 'base_price': 2500},
    ('Delhi', 'Bangalore'): {'duration': 1500, 'base_price': 3200},
    ('Delhi', 'Chennai'): {'duration': 1680, 'base_price': 3000},
    ('Delhi', 'Kolkata'): {'duration': 1020, 'base_price': 2800},
    ('Mumbai', 'Delhi'): {'duration': 960, 'base_price': 2500},
    ('Mumbai', 'Bangalore'): {'duration': 900, 'base_price': 2200},
    ('Mumbai', 'Chennai'): {'duration': 1200, 'base_price': 2600},
    ('Bangalore', 'Chennai'): {'duration': 300, 'base_price': 800},
    ('Chennai', 'Bangalore'): {'duration': 300, 'base_price': 800},
    ('Chennai', 'Delhi'): {'duration': 1680, 'base_price': 3000},
    ('Chennai', 'Mumbai'): {'duration': 1200, 'base_price': 2600},
    ('Chennai', 'Kolkata'): {'duration': 1620, 'base_price': 2900},
    ('Kolkata', 'Delhi'): {'duration': 1020, 'base_price': 2800},
    ('Kolkata', 'Chennai'): {'duration': 1620, 'base_price': 2900},
    ('Bangalore', 'Delhi'): {'duration': 1500, 'base_price': 3200},
    ('Bangalore', 'Mumbai'): {'duration': 900, 'base_price': 2200},
    ('Hyderabad', 'Chennai'): {'duration': 720, 'base_price': 1500},
    ('Hyderabad', 'Bangalore'): {'duration': 720, 'base_price': 1600},
    ('Hyderabad', 'Delhi'): {'duration': 1080, 'base_price': 2500},
    ('Hyderabad', 'Mumbai'): {'duration': 900, 'base_price': 2000},
}

# International high-speed (for destination cities served by rail)
INTERNATIONAL_ROUTES = {
    ('London', 'Paris'): {'duration': 135, 'base_price': 8500, 'operator': 'Eurostar'},
    ('Paris', 'London'): {'duration': 135, 'base_price': 8500, 'operator': 'Eurostar'},
    ('Tokyo', 'Osaka'): {'duration': 150, 'base_price': 7000, 'operator': 'Shinkansen'},
}

STATIONS = {
    'Delhi': 'New Delhi Railway Station (NDLS)',
    'Mumbai': 'Mumbai Central (BCT)',
    'Bangalore': 'Bengaluru City Junction (SBC)',
    'Chennai': 'Chennai Central (MAS)',
    'Kolkata': 'Howrah Junction (HWH)',
    'Paris': 'Gare du Nord',
    'London': 'St Pancras International',
    'Tokyo': 'Tokyo Station',
    'New York': 'Penn Station',
}


class TrainsService(BaseService):
    """Train search with mock data."""

    BASE_URL = ''

    def __init__(self):
        super().__init__()

    def search(self, departure: str, arrival: str, date) -> list:
        """Search train options."""
        return self._mock_trains(departure, arrival, date)

    def _mock_trains(self, departure: str, arrival: str, date) -> list:
        """Generate realistic mock train options."""
        route_key = (departure, arrival)
        reverse_key = (arrival, departure)

        route = (
            DOMESTIC_ROUTES.get(route_key)
            or DOMESTIC_ROUTES.get(reverse_key)
            or INTERNATIONAL_ROUTES.get(route_key)
            or INTERNATIONAL_ROUTES.get(reverse_key)
        )

        if not route:
            # If no direct train route exists, skip (trains don't fly over oceans)
            return []

        if isinstance(date, str):
            date = datetime.strptime(date, '%Y-%m-%d').date()

        base_dt = datetime.combine(date, datetime.min.time())
        options = []

        # Generate 2-4 train options
        num_trains = random.randint(2, 4)
        is_international = route_key in INTERNATIONAL_ROUTES or reverse_key in INTERNATIONAL_ROUTES

        if is_international:
            operators = [op for op in TRAIN_OPERATORS if op['code'] in ('ES', 'JR', 'TGV', 'ACL')]
        else:
            operators = [op for op in TRAIN_OPERATORS if op['code'] in ('RAJD', 'SHTB', 'DRNT', 'VB')]

        used_operators = random.sample(operators, min(num_trains, len(operators)))

        departure_times = sorted([
            base_dt + timedelta(hours=random.choice([5, 6, 8, 10, 14, 16, 20, 22]))
            for _ in range(len(used_operators))
        ])

        for i, operator in enumerate(used_operators):
            dep_time = departure_times[i]
            dur = route['duration'] + random.randint(-30, 45)
            dur = max(dur, 60)
            arr_time = dep_time + timedelta(minutes=dur)

            price_mult = random.uniform(0.8, 1.3)
            price_inr = Decimal(str(round(route['base_price'] * price_mult, -1)))
            price_usd = round(price_inr / Decimal('83.5'), 2)

            cabin = random.choice(['Sleeper', 'AC 3-Tier', 'AC 2-Tier', 'AC Chair Car'])
            if is_international:
                cabin = random.choice(['Standard', 'Standard Premier', 'Business Premier'])

            if 'Premier' in cabin or 'Business' in cabin:
                price_inr = price_inr * Decimal('1.8')
                price_usd = round(price_inr / Decimal('83.5'), 2)

            stops = random.randint(0, 3) if not is_international else random.randint(0, 1)

            # Trains are much greener
            carbon = round(dur * 0.02, 1)

            options.append({
                'transport_type': 'train',
                'provider_name': operator['name'],
                'route_number': f"{operator['code']}{random.randint(10000, 99999)}",
                'departure_city': departure,
                'departure_station': STATIONS.get(departure, f'{departure} Station'),
                'arrival_city': arrival,
                'arrival_station': STATIONS.get(arrival, f'{arrival} Station'),
                'departure_time': dep_time,
                'arrival_time': arr_time,
                'duration_minutes': dur,
                'price_inr': price_inr,
                'price_usd': price_usd,
                'stops': stops,
                'stop_details': [],
                'cabin_class': cabin,
                'carbon_kg': carbon,
                'delay_risk': round(random.uniform(0.05, 0.20), 2),
                'amenities': self._train_amenities(cabin, is_international),
                'is_mock': True,
            })

        return options

    def _train_amenities(self, cabin, is_international):
        amenities = ['Restroom']
        if is_international:
            amenities.extend(['WiFi', 'Power outlet', 'Dining car'])
            if 'Premier' in cabin or 'Business' in cabin:
                amenities.extend(['Meal included', 'Extra legroom'])
        else:
            amenities.append('Pantry car')
            if 'AC' in cabin:
                amenities.extend(['Charging point', 'Blanket'])
            if cabin == 'AC Chair Car':
                amenities.append('Reclining seat')
        return amenities
