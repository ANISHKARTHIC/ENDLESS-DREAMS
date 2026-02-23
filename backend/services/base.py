"""Base service class for external API integrations."""
import logging
import requests
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class BaseService:
    """Abstract base for external API services."""

    BASE_URL = ''
    TIMEOUT = 10

    def __init__(self):
        self.session = requests.Session()

    def _get(self, endpoint: str, params: Dict = None) -> Optional[Dict[str, Any]]:
        """Make a GET request with error handling."""
        try:
            url = f"{self.BASE_URL}{endpoint}"
            response = self.session.get(url, params=params, timeout=self.TIMEOUT)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.Timeout:
            logger.error(f"Timeout calling {endpoint}")
            return None
        except requests.exceptions.HTTPError as e:
            logger.error(f"HTTP error calling {endpoint}: {e}")
            return None
        except Exception as e:
            logger.error(f"Error calling {endpoint}: {e}")
            return None

    def _post(self, endpoint: str, data: Dict = None, json_data: Dict = None) -> Optional[Dict]:
        """Make a POST request with error handling."""
        try:
            url = f"{self.BASE_URL}{endpoint}"
            response = self.session.post(url, data=data, json=json_data, timeout=self.TIMEOUT)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Error calling {endpoint}: {e}")
            return None
