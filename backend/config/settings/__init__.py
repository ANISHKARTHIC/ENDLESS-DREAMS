import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), '.env.example'))

env = os.environ.get('DJANGO_ENV', 'development')

if env == 'production':
    from .production import *  # noqa
else:
    from .development import *  # noqa
