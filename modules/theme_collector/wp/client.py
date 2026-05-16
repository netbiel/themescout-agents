"""
WordPress REST API client for ThemeScout.
Auth: Application Password (Basic auth).
"""

import base64
from pathlib import Path

import requests

SECRET_DIR = Path(__file__).resolve().parent.parent.parent.parent.parent / ".secret"
CREDS_PATH = SECRET_DIR / "wp_credentials.txt"


def _load_credentials() -> tuple[str, str, str]:
    """Load WP credentials from .secret/wp_credentials.txt."""
    if not CREDS_PATH.exists():
        raise FileNotFoundError(f"WP credentials not found at {CREDS_PATH}")
    creds = {}
    for line in CREDS_PATH.read_text().strip().split("\n"):
        if "=" in line:
            k, v = line.split("=", 1)
            creds[k.strip()] = v.strip()
    return (
        creds.get("WP_BASE_URL", "https://themescout.pro"),
        creds.get("WP_USERNAME", ""),
        creds.get("WP_APP_PASSWORD", ""),
    )


class WordPressClient:
    """Thin wrapper for ThemeScout WordPress REST API."""

    def __init__(self, base_url: str = None, username: str = None, app_password: str = None):
        if base_url is None:
            base_url, username, app_password = _load_credentials()
        self.base_url = base_url.rstrip("/")
        self.api_url = f"{self.base_url}/wp-json"
        auth_string = f"{username}:{app_password.replace(' ', '')}"
        self.auth_header = "Basic " + base64.b64encode(auth_string.encode()).decode()

    def _headers(self) -> dict:
        return {
            "Authorization": self.auth_header,
            "Content-Type": "application/json",
        }

    def test_connection(self) -> dict:
        """Test API connection by fetching site info."""
        r = requests.get(f"{self.api_url}", headers=self._headers(), timeout=15)
        r.raise_for_status()
        data = r.json()
        return {"name": data.get("name"), "url": data.get("url"), "status": "ok"}

    def search_theme_profiles(self, theme_name: str) -> list[dict]:
        """Search for theme-profile posts by name."""
        r = requests.get(
            f"{self.api_url}/wp/v2/theme-profiles",
            params={"search": theme_name, "per_page": 5},
            headers=self._headers(),
            timeout=15,
        )
        r.raise_for_status()
        return r.json()

    def import_theme_profile(self, post_id: int, fields: dict, source: str = "python-pipeline") -> dict:
        """
        Import theme JSON via POST /wpagent/v1/theme-profile/import.

        Returns: {success, fields_written, skipped_fields} or {error, details}
        """
        payload = {
            "post_id": post_id,
            "fields": fields,
            "source": source,
        }
        r = requests.post(
            f"{self.api_url}/wpagent/v1/theme-profile/import",
            json=payload,
            headers=self._headers(),
            timeout=30,
        )
        r.raise_for_status()
        return r.json()
