#!/bin/sh
# Do NOT use set -e — migrate may fail if DB isn't ready yet; server must start regardless.

echo "=== Running database migrations ==="
python manage.py migrate --noinput || echo "WARNING: migrate failed (DB may not be ready). Continuing..."

echo "=== Seeding initial data (if needed) ==="
python manage.py shell -c "
try:
    from travel.models import CurrencyRate
    if not CurrencyRate.objects.exists():
        from services.currency_service import CurrencyService
        CurrencyService()._seed_mock_rates()
        print('Currency rates seeded.')
    else:
        print('Currency rates already present.')
except Exception as e:
    print(f'Seed skipped: {e}')
" 2>&1 || true

PORT="${PORT:-8000}"
echo "=== Starting Daphne on PORT=${PORT} ==="
exec daphne -b 0.0.0.0 -p "${PORT}" config.asgi:application
