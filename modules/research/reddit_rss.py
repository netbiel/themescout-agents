"""
Reddit RSS/JSON monitor — no API credentials required.

Uses public Reddit JSON feeds (.json suffix) to monitor subreddits
for theme-related discussions. Alternative to PRAW API which requires
manual approval since November 2025.

Rate limit: respect Reddit's robots.txt (~1 request per 2 seconds).
"""

import json
import re
import time
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path

import requests
import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
CONFIG_PATH = REPO_ROOT / "config" / "reddit_subreddits.yaml"
CACHE_DIR = REPO_ROOT / "data" / "cache" / "reddit"
USER_AGENT = "themescout-agent/0.1 (research monitor, no auth)"


@dataclass
class RedditThread:
    subreddit: str
    title: str
    url: str
    author: str
    score: int
    num_comments: int
    created_utc: float
    created_date: str
    selftext_preview: str
    matched_keywords: list
    relevance_score: float


def _load_config() -> dict:
    if CONFIG_PATH.exists():
        return yaml.safe_load(CONFIG_PATH.read_text(encoding="utf-8"))
    return {"monitored": []}


def fetch_subreddit_new(subreddit: str, limit: int = 25) -> list[dict]:
    """Fetch newest posts from a subreddit via public JSON feed."""
    url = f"https://www.reddit.com/r/{subreddit}/new.json?limit={limit}"
    headers = {"User-Agent": USER_AGENT}

    r = requests.get(url, headers=headers, timeout=15)
    r.raise_for_status()
    data = r.json()

    posts = []
    for child in data.get("data", {}).get("children", []):
        p = child.get("data", {})
        posts.append({
            "subreddit": subreddit,
            "title": p.get("title", ""),
            "url": f"https://www.reddit.com{p.get('permalink', '')}",
            "author": p.get("author", ""),
            "score": p.get("score", 0),
            "num_comments": p.get("num_comments", 0),
            "created_utc": p.get("created_utc", 0),
            "selftext": (p.get("selftext") or "")[:500],
        })
    return posts


def score_relevance(post: dict, keywords: list[str]) -> tuple[float, list[str]]:
    """Score post relevance based on keyword matches in title + selftext."""
    text = (post["title"] + " " + post.get("selftext", "")).lower()
    matched = [kw for kw in keywords if kw.lower() in text]
    if not matched:
        return 0.0, []

    score = len(matched) / len(keywords) if keywords else 0
    # Boost for high engagement
    if post["num_comments"] >= 10:
        score += 0.2
    if post["score"] >= 20:
        score += 0.1
    return min(score, 1.0), matched


def scan_subreddits(max_age_hours: int = 72) -> list[RedditThread]:
    """Scan all configured subreddits for relevant threads."""
    config = _load_config()
    monitored = config.get("monitored", [])
    cutoff = time.time() - (max_age_hours * 3600)
    results = []

    for sub in monitored:
        name = sub["name"]
        keywords = sub.get("keywords", [])
        priority = sub.get("priority", "low")

        try:
            posts = fetch_subreddit_new(name)
        except Exception as e:
            print(f"  Warning: failed to fetch r/{name}: {e}")
            continue

        for post in posts:
            if post["created_utc"] < cutoff:
                continue

            relevance, matched = score_relevance(post, keywords)
            if relevance <= 0:
                continue

            # Priority boost
            if priority == "high":
                relevance = min(relevance + 0.2, 1.0)

            results.append(RedditThread(
                subreddit=name,
                title=post["title"],
                url=post["url"],
                author=post["author"],
                score=post["score"],
                num_comments=post["num_comments"],
                created_utc=post["created_utc"],
                created_date=datetime.fromtimestamp(post["created_utc"], tz=timezone.utc).strftime("%Y-%m-%d %H:%M"),
                selftext_preview=post.get("selftext", "")[:200],
                matched_keywords=matched,
                relevance_score=round(relevance, 2),
            ))

        time.sleep(2)  # Rate limit

    results.sort(key=lambda x: x.relevance_score, reverse=True)
    return results


def save_scan_results(threads: list[RedditThread]) -> str:
    """Save scan results to cache."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    output_path = CACHE_DIR / f"reddit-scan-{date_str}.json"
    output_path.write_text(
        json.dumps([asdict(t) for t in threads], indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    return str(output_path)
