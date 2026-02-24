FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=config.settings.production

WORKDIR /app

# System deps for psycopg2
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Collect static files at build time with a dummy secret key
RUN SECRET_KEY=build-collect-static-placeholder \
    DJANGO_ALLOWED_HOSTS=localhost \
    python manage.py collectstatic --noinput

# Make entrypoint executable
RUN chmod +x /app/entrypoint.sh

EXPOSE 8000

# entrypoint.sh runs migrate → seeds currencies → starts Daphne
ENTRYPOINT ["/app/entrypoint.sh"]
