"""Currency service - exchange rates with INR base + mock fallback."""
import logging
from datetime import timedelta
from decimal import Decimal
from django.conf import settings
from django.utils import timezone
from .base import BaseService

logger = logging.getLogger(__name__)

# Default exchange rates (INR base) - updated periodically via API
DEFAULT_RATES = {
    'INR': {'name': 'Indian Rupee', 'symbol': '\u20b9', 'rate': Decimal('1.000000')},
    'USD': {'name': 'US Dollar', 'symbol': '$', 'rate': Decimal('0.011976')},
    'EUR': {'name': 'Euro', 'symbol': '\u20ac', 'rate': Decimal('0.010980')},
    'GBP': {'name': 'British Pound', 'symbol': '\u00a3', 'rate': Decimal('0.009460')},
    'JPY': {'name': 'Japanese Yen', 'symbol': '\u00a5', 'rate': Decimal('1.835000')},
    'AED': {'name': 'UAE Dirham', 'symbol': 'AED', 'rate': Decimal('0.043980')},
    'SGD': {'name': 'Singapore Dollar', 'symbol': 'S$', 'rate': Decimal('0.016050')},
    'THB': {'name': 'Thai Baht', 'symbol': '\u0e3f', 'rate': Decimal('0.413000')},
    'AUD': {'name': 'Australian Dollar', 'symbol': 'A$', 'rate': Decimal('0.018350')},
    'CAD': {'name': 'Canadian Dollar', 'symbol': 'C$', 'rate': Decimal('0.016520')},
    'CHF': {'name': 'Swiss Franc', 'symbol': 'CHF', 'rate': Decimal('0.010580')},
    'MYR': {'name': 'Malaysian Ringgit', 'symbol': 'RM', 'rate': Decimal('0.053200')},
}


class CurrencyService(BaseService):
    """Exchange rate service with 30-min caching."""

    def __init__(self):
        super().__init__()
        self.api_key = getattr(settings, 'EXCHANGE_RATE_API_KEY', '')
        # Use keyed endpoint when API key is available, otherwise open endpoint
        if self.api_key:
            self.BASE_URL = f'https://v6.exchangerate-api.com/v6/{self.api_key}'
        else:
            self.BASE_URL = 'https://api.exchangerate-api.com/v4'

    def refresh_rates_if_needed(self):
        """Refresh currency rates if older than 30 minutes."""
        from travel.models import CurrencyRate

        # Check if we have any rates
        latest = CurrencyRate.objects.order_by('-updated_at').first()
        if latest and (timezone.now() - latest.updated_at) < timedelta(minutes=30):
            return  # Fresh enough

        if self.api_key:
            self._fetch_live_rates()
        else:
            self._seed_mock_rates()

    def _fetch_live_rates(self):
        """Fetch live rates from API."""
        from travel.models import CurrencyRate

        # v6 keyed endpoint: /v6/{key}/latest/INR -> {conversion_rates: {...}}
        # v4 open endpoint: /v4/latest/INR       -> {rates: {...}}
        data = self._get('/latest/INR')
        if not data:
            self._seed_mock_rates()
            return

        # Handle both v4 (data['rates']) and v6 (data['conversion_rates']) formats
        rates = data.get('conversion_rates') or data.get('rates')
        if not rates:
            self._seed_mock_rates()
            return

        for code, rate in rates.items():
            if code in DEFAULT_RATES:
                info = DEFAULT_RATES[code]
                CurrencyRate.objects.update_or_create(
                    currency_code=code,
                    defaults={
                        'currency_name': info['name'],
                        'symbol': info['symbol'],
                        'rate_from_inr': Decimal(str(rate)),
                    },
                )

    def _seed_mock_rates(self):
        """Seed the DB with default rates."""
        from travel.models import CurrencyRate

        for code, info in DEFAULT_RATES.items():
            CurrencyRate.objects.update_or_create(
                currency_code=code,
                defaults={
                    'currency_name': info['name'],
                    'symbol': info['symbol'],
                    'rate_from_inr': info['rate'],
                },
            )

    def convert(self, amount: float, from_currency: str, to_currency: str) -> float:
        """Convert an amount between two currencies using INR as base."""
        from travel.models import CurrencyRate

        if from_currency == to_currency:
            return amount

        self.refresh_rates_if_needed()

        # Get rates for both currencies
        try:
            if from_currency == 'INR':
                to_rate = CurrencyRate.objects.get(currency_code=to_currency)
                return amount * float(to_rate.rate_from_inr)
            elif to_currency == 'INR':
                from_rate = CurrencyRate.objects.get(currency_code=from_currency)
                return amount / float(from_rate.rate_from_inr)
            else:
                from_rate = CurrencyRate.objects.get(currency_code=from_currency)
                to_rate = CurrencyRate.objects.get(currency_code=to_currency)
                # Convert from_currency -> INR -> to_currency
                inr_amount = amount / float(from_rate.rate_from_inr)
                return inr_amount * float(to_rate.rate_from_inr)
        except CurrencyRate.DoesNotExist:
            logger.warning(f"Currency rate not found for {from_currency} or {to_currency}")
            return amount  # fallback: no conversion

    def get_all_rates(self) -> dict:
        """Get all rates as a dict."""
        from travel.models import CurrencyRate
        self.refresh_rates_if_needed()
        rates = {}
        for rate in CurrencyRate.objects.all():
            rates[rate.currency_code] = {
                'name': rate.currency_name,
                'symbol': rate.symbol,
                'rate': float(rate.rate_from_inr),
            }
        return rates
