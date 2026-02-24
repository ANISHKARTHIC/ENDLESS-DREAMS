"""Travel API views - search for travel options and currency rates."""
import hashlib
import logging
from datetime import datetime

from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import TravelOption, TravelQueryCache, CurrencyRate
from .serializers import (
    TravelSearchSerializer,
    TravelOptionSerializer,
    CurrencyRateSerializer,
)
from services.flights_service import FlightsService
from services.trains_service import TrainsService
from services.buses_service import BusesService
from services.currency_service import CurrencyService

logger = logging.getLogger(__name__)


class TravelSearchView(APIView):
    """Search for travel options (flights, trains, buses)."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = TravelSearchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        departure = data['departure_city']
        arrival = data['arrival_city']
        date = data['travel_date']
        transport_types = data.get('transport_types', ['flight', 'train', 'bus'])

        # Check cache
        cache_key = self._cache_key(departure, arrival, date, transport_types)
        cached = self._get_cached(cache_key)
        if cached:
            return Response(cached)

        all_options = []

        if 'flight' in transport_types:
            flights_svc = FlightsService()
            flights = flights_svc.search(departure, arrival, date)
            all_options.extend(flights)

        if 'train' in transport_types:
            trains_svc = TrainsService()
            trains = trains_svc.search(departure, arrival, date)
            all_options.extend(trains)

        if 'bus' in transport_types:
            buses_svc = BusesService()
            buses = buses_svc.search(departure, arrival, date)
            all_options.extend(buses)

        # Persist options to DB
        saved_options = []
        for opt in all_options:
            obj = TravelOption.objects.create(**opt)
            saved_options.append(obj)

        # Annotate badges
        serialized = TravelOptionSerializer(saved_options, many=True).data
        serialized = self._annotate_badges(serialized)

        result = {
            'departure_city': departure,
            'arrival_city': arrival,
            'travel_date': str(date),
            'total_options': len(serialized),
            'options': serialized,
        }

        self._cache_result(cache_key, result)
        return Response(result)

    def _annotate_badges(self, options):
        """Add Fastest / Cheapest / Recommended badges."""
        if not options:
            return options

        # Find cheapest
        cheapest = min(options, key=lambda x: float(x['price_inr']))
        # Find fastest
        fastest = min(options, key=lambda x: x['duration_minutes'])
        # Recommended = best value (low price * low duration * low carbon)
        def value_score(o):
            price = float(o['price_inr'])
            dur = o['duration_minutes']
            carbon = o['carbon_kg'] or 1
            return (price / 1000) * (dur / 60) * (carbon / 10)

        recommended = min(options, key=value_score)

        for opt in options:
            badges = []
            if opt['id'] == cheapest['id']:
                badges.append('cheapest')
            if opt['id'] == fastest['id']:
                badges.append('fastest')
            if opt['id'] == recommended['id']:
                badges.append('recommended')
            opt['badges'] = badges

        return options

    def _cache_key(self, departure, arrival, date, types):
        raw = f"{departure}:{arrival}:{date}:{','.join(sorted(types))}"
        return hashlib.md5(raw.encode()).hexdigest()

    def _get_cached(self, cache_key):
        try:
            entry = TravelQueryCache.objects.get(
                cache_key=cache_key,
                expires_at__gt=timezone.now(),
            )
            return entry.results
        except TravelQueryCache.DoesNotExist:
            return None

    def _cache_result(self, cache_key, result):
        from datetime import timedelta
        TravelQueryCache.objects.update_or_create(
            cache_key=cache_key,
            defaults={
                'results': result,
                'expires_at': timezone.now() + timedelta(minutes=30),
            },
        )


class TravelOptionDetailView(APIView):
    """Get a single travel option."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, option_id):
        try:
            option = TravelOption.objects.get(id=option_id)
        except TravelOption.DoesNotExist:
            return Response({'error': 'Travel option not found'}, status=404)
        return Response(TravelOptionSerializer(option).data)


class CurrencyRatesView(APIView):
    """Get exchange rates (INR base)."""
    permission_classes = [permissions.AllowAny]

    # Hardcoded fallback so the UI never breaks even if DB is unavailable
    FALLBACK_RATES = [
        {'currency_code': 'INR', 'currency_name': 'Indian Rupee',     'symbol': '\u20b9', 'rate_from_inr': '1.000000'},
        {'currency_code': 'USD', 'currency_name': 'US Dollar',        'symbol': '$',      'rate_from_inr': '0.011976'},
        {'currency_code': 'EUR', 'currency_name': 'Euro',             'symbol': '\u20ac', 'rate_from_inr': '0.010980'},
        {'currency_code': 'GBP', 'currency_name': 'British Pound',    'symbol': '\u00a3', 'rate_from_inr': '0.009460'},
        {'currency_code': 'JPY', 'currency_name': 'Japanese Yen',     'symbol': '\u00a5', 'rate_from_inr': '1.835000'},
        {'currency_code': 'AED', 'currency_name': 'UAE Dirham',       'symbol': 'AED',    'rate_from_inr': '0.043980'},
        {'currency_code': 'SGD', 'currency_name': 'Singapore Dollar', 'symbol': 'S$',     'rate_from_inr': '0.016050'},
        {'currency_code': 'AUD', 'currency_name': 'Australian Dollar','symbol': 'A$',     'rate_from_inr': '0.018350'},
        {'currency_code': 'CAD', 'currency_name': 'Canadian Dollar',  'symbol': 'C$',     'rate_from_inr': '0.016520'},
    ]

    def get(self, request):
        try:
            svc = CurrencyService()
            svc.refresh_rates_if_needed()
            rates = CurrencyRate.objects.all()
            return Response({
                'base': 'INR',
                'rates': CurrencyRateSerializer(rates, many=True).data,
            })
        except Exception as e:
            logger.error(f"CurrencyRatesView DB error, returning fallback: {e}")
            return Response({'base': 'INR', 'rates': self.FALLBACK_RATES})


class CurrencyConvertView(APIView):
    """Convert price between currencies."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        amount = request.query_params.get('amount')
        from_currency = request.query_params.get('from', 'INR')
        to_currency = request.query_params.get('to', 'USD')

        if not amount:
            return Response({'error': 'amount required'}, status=400)

        try:
            amount = float(amount)
        except ValueError:
            return Response({'error': 'Invalid amount'}, status=400)

        svc = CurrencyService()
        converted = svc.convert(amount, from_currency, to_currency)

        return Response({
            'original_amount': amount,
            'from': from_currency,
            'to': to_currency,
            'converted_amount': round(converted, 2),
        })
