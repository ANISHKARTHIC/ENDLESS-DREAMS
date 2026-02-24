#!/bin/sh
set -e

echo "=== Running database migrations ==="
python manage.py migrate --noinput

echo "=== Seeding initial data (if needed) ==="
python manage.py shell -c "
from travel.models import CurrencyRate
if not CurrencyRate.objects.exists():
    from services.currency_service import CurrencyService
    CurrencyService()._seed_mock_rates()
    print('Currency rates seeded.')
else:
    print('Currency rates already present.')
" || true

echo "=== Starting server ==="
exec daphne -b 0.0.0.0 -p 8000 config.asgi:application
