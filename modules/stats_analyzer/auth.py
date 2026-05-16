"""
OAuth 2.0 authentication for Google Analytics 4 Data API.

Flow:
1. First run: opens browser for Google login, saves token to .secret/ga4_token.json
2. Subsequent runs: reuses saved token, refreshes if expired
"""

import json
from pathlib import Path

from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ["https://www.googleapis.com/auth/analytics.readonly"]

# Paths relative to repo root
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SECRET_DIR = REPO_ROOT.parent / ".secret"
CLIENT_SECRET_GLOB = "client_secret_*.json"
TOKEN_PATH = SECRET_DIR / "ga4_token.json"


def _find_client_secret() -> Path:
    """Find the OAuth client secret JSON in .secret/ directory."""
    files = list(SECRET_DIR.glob(CLIENT_SECRET_GLOB))
    if not files:
        raise FileNotFoundError(
            f"No OAuth client secret found in {SECRET_DIR}. "
            f"Expected a file matching '{CLIENT_SECRET_GLOB}'."
        )
    return files[0]


def get_credentials() -> Credentials:
    """Get valid OAuth credentials, prompting browser login if needed."""
    creds = None

    if TOKEN_PATH.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)

    if creds and creds.valid:
        return creds

    if creds and creds.expired and creds.refresh_token:
        from google.auth.transport.requests import Request
        creds.refresh(Request())
    else:
        client_secret = _find_client_secret()
        flow = InstalledAppFlow.from_client_secrets_file(str(client_secret), SCOPES)
        creds = flow.run_local_server(port=0)

    # Save token for next run
    TOKEN_PATH.write_text(creds.to_json())
    return creds


def get_ga4_client() -> BetaAnalyticsDataClient:
    """Return an authenticated GA4 Data API client."""
    creds = get_credentials()
    return BetaAnalyticsDataClient(credentials=creds)
