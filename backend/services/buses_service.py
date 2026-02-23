"""Buses service - search for bus options with mock fallback."""
import logging
import random
from datetime import datetime, timedelta
from decimal import Decimal
from django.conf import settings
from .base import BaseService

logger = logging.getLogger(__name__)

BUS_OPERATORS = [
    {'name': 'RedBus Premium', 'code': 'RB', 'rating': 4.0},
    {'name': 'VRL Travels', 'code': 'VRL', 'rating': 4.2},
    {'name': 'SRS Travels', 'code': 'SRS', 'rating': 3.8},
    {'name': 'Orange Travels', 'code': 'OT', 'rating': 3.6},
    {'name': 'KPN Travels', 'code': 'KPN', 'rating': 3.9},
    {'name': 'Greenline', 'code': 'GL', 'rating': 4.1},
    {'name': 'FlixBus', 'code': 'FLX', 'rating': 4.0},
    {'name': 'National Express', 'code': 'NX', 'rating': 3.7},
]

# Bus routes (domestic Indian + some international short-haul)
BUS_ROUTES = {
    ('Delhi', 'Mumbai'): {'duration': 1080, 'base_price': 1200},
    ('Delhi', 'Bangalore'): {'duration': 1800, 'base_price': 2000},
    ('Delhi', 'Chennai'): {'duration': 2100, 'base_price': 2200},
    ('Delhi', 'Kolkata'): {'duration': 1320, 'base_price': 1500},
    ('Mumbai', 'Bangalore'): {'duration': 960, 'base_price': 1100},
    ('Mumbai', 'Chennai'): {'duration': 1200, 'base_price': 1400},
    ('Mumbai', 'Delhi'): {'duration': 1080, 'base_price': 1200},
    ('Bangalore', 'Chennai'): {'duration': 360, 'base_price': 600},
    ('Bangalore', 'Mumbai'): {'duration': 960, 'base_price': 1100},
    ('Chennai', 'Bangalore'): {'duration': 360, 'base_price': 600},
    ('Chennai', 'Delhi'): {'duration': 2100, 'base_price': 2200},
    ('Chennai', 'Mumbai'): {'duration': 1200, 'base_price': 1400},
    ('Chennai', 'Kolkata'): {'duration': 1800, 'base_price': 1800},
    ('Chennai', 'Hyderabad'): {'duration': 720, 'base_price': 800},
    ('Kolkata', 'Delhi'): {'duration': 1320, 'base_price': 1500},
    ('Kolkata', 'Mumbai'): {'duration': 1800, 'base_price': 1800},
    ('Hyderabad', 'Bangalore'): {'duration': 600, 'base_price': 700},
    ('Hyderabad', 'Chennai'): {'duration': 720, 'base_price': 800},
    ('Hyderabad', 'Mumbai'): {'duration': 780, 'base_price': 900},
    ('Hyderabad', 'Delhi'): {'duration': 1440, 'base_price': 1600},
}

TERMINALS = {
    'Delhi': 'Kashmere Gate ISBT',
    'Mumbai': 'Mumbai Central Bus Depot',
    'Bangalore': 'Majestic Bus Terminal',
    'Chennai': 'Chennai Mofussil Bus Terminus (CMBT)',
    'Kolkata': 'Esplanade Bus Terminus',
}


class BusesService(BaseService):
    """Bus search with mock data."""

    BASE_URL = ''

    def __init__(self):
        super().__init__()

    def search(self, departure: str, arrival: str, date) -> list:
        """Search bus options."""
        return self._mock_buses(departure, arrival, date)

    def _mock_buses(self, departure: str, arrival: str, date) -> list:
        """Generate realistic mock bus options."""
        route_key = (departure, arrival)
        reverse_key = (arrival, departure)

        route = BUS_ROUTES.get(route_key) or BUS_ROUTES.get(reverse_key)
        is_known_domestic = route_key in BUS_ROUTES or reverse_key in BUS_ROUTES

        if not route:
            # Generate a generic bus route for any city pair
            route = {'duration': random.randint(360, 1200), 'base_price': random.randint(800, 2500)}

        if isinstance(date, str):
            date = datetime.strptime(date, '%Y-%m-%d').date()

        base_dt = datetime.combine(date, datetime.min.time())
        options = []

        num_buses = random.randint(3, 5)
        # Use international operators for non-domestic routes
        if is_known_domestic:
            available_operators = [op for op in BUS_OPERATORS if op['code'] in ('RB', 'VRL', 'SRS', 'OT', 'KPN', 'GL')]
        else:
            available_operators = [op for op in BUS_OPERATORS if op['code'] in ('FLX', 'NX', 'GL')]
        used_operators = random.sample(available_operators, min(num_buses, len(available_operators)))

        # Buses typically depart in evening / night for long routes
        departure_hours = [18, 19, 20, 21, 22, 23] if route['duration'] > 600 else [6, 8, 10, 14, 17, 20]
        departure_times = sorted([
            base_dt + timedelta(hours=random.choice(departure_hours))
            for _ in range(len(used_operators))
        ])

        for i, operator in enumerate(used_operators):
            dep_time = departure_times[i]
            dur = route['duration'] + random.randint(-30, 60)
            dur = max(dur, 180)
            arr_time = dep_time + timedelta(minutes=dur)

            price_mult = random.uniform(0.7, 1.4)
            price_inr = Decimal(str(round(route['base_price'] * price_mult, -1)))
            price_usd = round(price_inr / Decimal('83.5'), 2)

            bus_type = random.choice([
                'AC Seater', 'AC Sleeper', 'Non-AC Seater',
                'Volvo Multi-Axle', 'AC Semi-Sleeper',
            ])

            if 'Volvo' in bus_type or 'Sleeper' in bus_type:
                price_inr = price_inr * Decimal('1.4')
                price_usd = round(price_inr / Decimal('83.5'), 2)

            stops = random.randint(2, 6)

            # Buses are lower carbon than flights but more than trains
            carbon = round(dur * 0.04, 1)

            options.append({
                'transport_type': 'bus',
                'provider_name': operator['name'],
                'route_number': f"{operator['code']}-{random.randint(100, 999)}",
                'departure_city': departure,
                'departure_station': TERMINALS.get(departure, f'{departure} Bus Terminal'),
                'arrival_city': arrival,
                'arrival_station': TERMINALS.get(arrival, f'{arrival} Bus Terminal'),
                'departure_time': dep_time,
                'arrival_time': arr_time,
                'duration_minutes': dur,
                'price_inr': price_inr,
                'price_usd': price_usd,
                'stops': stops,
                'stop_details': [],
                'cabin_class': bus_type,
                'carbon_kg': carbon,
                'delay_risk': round(random.uniform(0.10, 0.35), 2),
                'amenities': self._bus_amenities(bus_type),
                'is_mock': True,
            })

        return options

    def _bus_amenities(self, bus_type):
        amenities = ['Luggage storage']
        if 'AC' in bus_type:
            amenities.append('Air conditioning')
        if 'Volvo' in bus_type:
            amenities.extend(['Charging point', 'Reclining seats', 'Reading light'])
        if 'Sleeper' in bus_type:
            amenities.extend(['Blanket', 'Curtain'])
        if random.random() > 0.5:
            amenities.append('Water bottle')
        return amenities
