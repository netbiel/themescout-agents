"""
Microsoft Clarity Data Export API integration.

API docs: https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-data-export-api

Limitations:
- Max 10 API requests per project per day
- Data retrieval: last 1-3 days only
- Max 3 dimensions per request
- Response limited to 1,000 rows
"""

import json
from pathlib import Path

import requests

SECRET_DIR = Path(__file__).resolve().parent.parent.parent.parent / ".secret"
TOKEN_PATH = SECRET_DIR / "clarity_token.txt"

API_BASE = "https://www.clarity.ms/export-data/api/v1/project-live-insights"

# Available dimensions: Browser, Device, Country/Region, OS, Source, Medium,
#                       Campaign, Channel, URL

# Available metrics in response: Scroll Depth, Engagement Time, Traffic,
#   Popular Pages, Dead Click Count, Rage Click Count, Quickback Click,
#   Excessive Scroll, Script Error Count, Error Click Count


def _get_token() -> str:
    """Read Clarity API token from .secret/clarity_token.txt."""
    if not TOKEN_PATH.exists():
        raise FileNotFoundError(
            f"Clarity API token not found at {TOKEN_PATH}. "
            "Generate one in Clarity → Settings → Data Export → Generate new API token, "
            "then save it to .secret/clarity_token.txt"
        )
    return TOKEN_PATH.read_text().strip()


def fetch_insights(num_of_days: int = 3, dimensions: list[str] | None = None) -> dict:
    """Fetch live insights from Clarity API.

    Args:
        num_of_days: 1, 2, or 3 days of data.
        dimensions: Up to 3 dimensions (e.g., ["URL", "Device", "Source"]).
    """
    if num_of_days not in (1, 2, 3):
        raise ValueError("numOfDays must be 1, 2, or 3")
    if dimensions and len(dimensions) > 3:
        raise ValueError("Max 3 dimensions per request")

    token = _get_token()
    params = {"numOfDays": str(num_of_days)}
    if dimensions:
        for i, dim in enumerate(dimensions, 1):
            params[f"dimension{i}"] = dim

    response = requests.get(
        API_BASE,
        params=params,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    if response.status_code == 500 and not response.text:
        # Clarity returns 500 with empty body when there's insufficient data
        # for the requested period (known issue with low-traffic sites)
        return {"error": "no_data", "message": f"Clarity returned 500 — likely insufficient data for last {num_of_days} day(s)"}
    response.raise_for_status()
    return response.json()


def get_overview(num_of_days: int = 3) -> dict:
    """Get overall Clarity metrics without dimension breakdown."""
    return fetch_insights(num_of_days)


def get_by_url(num_of_days: int = 3) -> dict:
    """Get Clarity metrics broken down by URL."""
    return fetch_insights(num_of_days, dimensions=["URL"])


def get_by_source(num_of_days: int = 3) -> dict:
    """Get Clarity metrics broken down by traffic source."""
    return fetch_insights(num_of_days, dimensions=["Source", "Medium"])


def get_by_device(num_of_days: int = 3) -> dict:
    """Get Clarity metrics broken down by device type."""
    return fetch_insights(num_of_days, dimensions=["Device"])
