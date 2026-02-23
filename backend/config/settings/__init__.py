import os
from dotenv import load_dotenv

_project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
_env_file = os.path.join(_project_root, '.env')
if not os.path.exists(_env_file):
    _env_file = os.path.join(_project_root, '.env.example')
load_dotenv(_env_file)

env = os.environ.get('DJANGO_ENV', 'development')

if env == 'production':
    from .production import *  # noqa
else:
    from .development import *  # noqa
