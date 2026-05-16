"""
Port of Apps Script fetchPostIDs() from v3.20.3.
Resolves theme name → WP post ID. Caches results.
"""

import json
import time
from pathlib import Path

from .client import WordPressClient

CACHE_PATH = Path(__file__).resolve().parent.parent.parent.parent / "data" / "cache" / "wp-post-ids.json"


def _load_cache() -> dict:
    if CACHE_PATH.exists():
        return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    return {}


def _save_cache(cache: dict):
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(cache, indent=2), encoding="utf-8")


def resolve_post_id(theme_name: str, wp_client: WordPressClient, force_refresh: bool = False) -> int | None:
    """
    Search WP for theme-profile post matching theme_name.
    Returns post ID or None. Caches results.
    """
    cache = _load_cache()
    if not force_refresh and theme_name in cache:
        return cache[theme_name]

    results = wp_client.search_theme_profiles(theme_name)
    if results:
        post_id = results[0].get("id")
        cache[theme_name] = post_id
        _save_cache(cache)
        return post_id

    cache[theme_name] = None
    _save_cache(cache)
    return None


def resolve_all(theme_names: list[str], wp_client: WordPressClient) -> dict[str, int | None]:
    """Resolve post IDs for multiple themes with rate limiting."""
    results = {}
    for name in theme_names:
        results[name] = resolve_post_id(name, wp_client)
        time.sleep(0.3)  # Rate limit matching Apps Script
    return results
