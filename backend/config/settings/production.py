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
    'localhost',
    '127.0.0.1',
]

# ── Database ──────────────────────────────────────────────────────────────────
# Fly.io attaches Postgres and injects DATABASE_URL automatically.
# Fall back to individual env vars if DATABASE_URL is not set.
_db_url = os.environ.get('DATABASE_URL')
if _db_url:
    DATABASES = {
        'default': dj_database_url.parse(
            _db_url,
            conn_max_age=600,
            ssl_require='sslmode' not in _db_url,
        )
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
    'https://endless-dreams.vercel.app',
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
