"""Production settings – Fly.io deployment."""
import dj_database_url
from .base import *  # noqa

DEBUG = False

_allowed_hosts_env = [h.strip() for h in os.environ.get('DJANGO_ALLOWED_HOSTS', '').split(',') if h.strip()]
_railway_public = os.environ.get('RAILWAY_PUBLIC_DOMAIN', '').strip()

ALLOWED_HOSTS = [
    *_allowed_hosts_env,
    *([_railway_public] if _railway_public else []),
    '.up.railway.app',
    'healthcheck.railway.app',
    'localhost',
    '127.0.0.1',
]

# ── Database ──────────────────────────────────────────────────────────────────
# Railway injects DATABASE_URL. Normalise postgres:// → postgresql:// for
# dj_database_url, validate the result, and fall back to SQLite if anything
# looks wrong so Daphne can still start while DB is provisioning.
_db_url = os.environ.get('DATABASE_URL', '').strip()

# Railway sometimes provides postgres:// which dj_database_url may not recognise
if _db_url.startswith('postgres://'):
    _db_url = 'postgresql://' + _db_url[len('postgres://'):]

if _db_url:
    try:
        _parsed = dj_database_url.parse(
            _db_url,
            conn_max_age=600,
            conn_health_checks=True,
            ssl_require='sslmode' not in _db_url,
        )
        # Only use parsed config if it contains a valid database name
        if _parsed.get('NAME'):
            DATABASES = {'default': _parsed}
        else:
            raise ValueError(f'dj_database_url returned no NAME for URL: {_db_url[:40]}...')
    except Exception as _db_exc:
        import warnings
        warnings.warn(f'DATABASE_URL parse failed ({_db_exc}), falling back to SQLite')
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.sqlite3',
                'NAME': BASE_DIR / 'db.sqlite3',
            }
        }
else:
    # No DATABASE_URL — use SQLite so the app can at least start
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# ── Redis / Channels ──────────────────────────────────────────────────────────
REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')

CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [REDIS_URL],
        },
    }
}

# ── Celery ────────────────────────────────────────────────────────────────────
CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL

# ── CORS ──────────────────────────────────────────────────────────────────────
# Accepts both the Vercel production domain and any preview deployments.
_frontend_url = os.environ.get('FRONTEND_URL', '')
CORS_ALLOWED_ORIGINS = [o for o in [
    _frontend_url,
    'https://endless-dreams-inno.vercel.app',
] if o]

CORS_ALLOWED_ORIGIN_REGEXES = [
    r'^https://.*\.vercel\.app$',
]

# ── Security ──────────────────────────────────────────────────────────────────
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
X_FRAME_OPTIONS = 'DENY'
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# ── Logging ───────────────────────────────────────────────────────────────────
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'WARNING',
    },
}
