"""
PageSpeed Insights Fetcher — full PSI measurement for validated candidates.

For each candidate: 3 runs mobile + 3 runs desktop, median for all metrics.
Outputs base JSON with pagespeed_data filled.

Architecture decisions:
  - 5s pause between PSI calls (rate limit + reduce run correlation)
  - Median of 3 runs (robust to outliers)
  - Variance tracking: flags themes needing re-verification (>10 points spread)
  - Atomic writes for resume capability
  - PSI API free tier: 25K queries/day (our usage: 6 per theme)
"""

import json
import logging
import statistics
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

import requests
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
PSI_API_BASE = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
USER_AGENT = "ThemeScout-PSIFetcher/1.0 (+https://themescout.pro/about)"
RUNS_PER_STRATEGY = 3
PAUSE_BETWEEN_CALLS = 5
VARIANCE_THRESHOLD = 10
BORDERLINE_RANGE = (55, 65)  # mobile score range triggering re-verification


def _setup_logger(batch_name: str) -> logging.Logger:
    log_dir = REPO_ROOT / "data" / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    date = datetime.now().strftime("%Y-%m-%d")
    logger = logging.getLogger(f"psi-fetcher-{batch_name}")
    logger.setLevel(logging.DEBUG)
    if not logger.handlers:
        fh = logging.FileHandler(log_dir / f"psi-fetcher-{batch_name}-{date}.log", encoding="utf-8")
        fh.setFormatter(logging.Formatter("%(asctime)s | %(levelname)s | %(message)s"))
        logger.addHandler(fh)
    return logger


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=3, min=10, max=60),
       retry=retry_if_exception_type((requests.HTTPError,)))
def _single_psi_call(url: str, strategy: str, api_key: str, logger: logging.Logger) -> dict | None:
    """Execute a single PSI API call. Returns extracted metrics or None on failure."""
    try:
        r = requests.get(PSI_API_BASE, params={
            "url": url,
            "category": "performance",
            "strategy": strategy,
            "key": api_key,
        }, timeout=60, headers={"User-Agent": USER_AGENT})

        if r.status_code == 429:
            logger.warning(f"PSI rate limit (429) for {url} [{strategy}]")
            r.raise_for_status()

        data = r.json()
        if "lighthouseResult" not in data:
            error = data.get("error", {}).get("message", "No lighthouseResult")
            logger.error(f"PSI error for {url} [{strategy}]: {error}")
            return None

        lhr = data["lighthouseResult"]
        score = lhr["categories"]["performance"]["score"]
        audits = lhr.get("audits", {})

        lcp = audits.get("largest-contentful-paint", {}).get("numericValue", 0) / 1000  # ms -> s
        cls = audits.get("cumulative-layout-shift", {}).get("numericValue", 0)

        return {
            "score": round(score * 100),
            "lcp": round(lcp, 2),
            "cls": round(cls, 3),
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }
    except requests.Timeout:
        logger.error(f"PSI timeout for {url} [{strategy}]")
        return None
    except Exception as e:
        logger.error(f"PSI call failed for {url} [{strategy}]: {e}")
        return None


def measure_theme(demo_url: str, api_key: str, logger: logging.Logger) -> dict:
    """
    Execute 3 mobile + 3 desktop PSI runs. Return pagespeed_data dict.
    """
    raw_runs = {"mobile": [], "desktop": []}

    for strategy in ("mobile", "desktop"):
        for run_num in range(1, RUNS_PER_STRATEGY + 1):
            logger.info(f"PSI run {run_num}/{RUNS_PER_STRATEGY} [{strategy}] for {demo_url}")
            result = _single_psi_call(demo_url, strategy, api_key, logger)

            if result:
                result["run"] = run_num
                raw_runs[strategy].append(result)
            else:
                logger.warning(f"Run {run_num} [{strategy}] failed for {demo_url}")

            if run_num < RUNS_PER_STRATEGY or strategy == "mobile":
                time.sleep(PAUSE_BETWEEN_CALLS)

    # Compute medians
    def median_of(runs, key):
        values = [r[key] for r in runs if r.get(key) is not None]
        return round(statistics.median(values), 2) if values else 0

    mobile_runs = raw_runs["mobile"]
    desktop_runs = raw_runs["desktop"]

    pagespeed_mobile = int(median_of(mobile_runs, "score")) if mobile_runs else 0
    pagespeed_desktop = int(median_of(desktop_runs, "score")) if desktop_runs else 0

    # Variance
    mobile_scores = [r["score"] for r in mobile_runs]
    desktop_scores = [r["score"] for r in desktop_runs]
    variance_mobile = max(mobile_scores) - min(mobile_scores) if len(mobile_scores) >= 2 else 0
    variance_desktop = max(desktop_scores) - min(desktop_scores) if len(desktop_scores) >= 2 else 0

    needs_reverification = (
        variance_mobile > VARIANCE_THRESHOLD or
        variance_desktop > VARIANCE_THRESHOLD or
        BORDERLINE_RANGE[0] <= pagespeed_mobile <= BORDERLINE_RANGE[1]
    )

    performance_rating = round((pagespeed_mobile + pagespeed_desktop) / 2) if (pagespeed_mobile and pagespeed_desktop) else 0
    psi_link = f"https://pagespeed.web.dev/analysis?url={quote(demo_url, safe='')}"

    return {
        "pagespeed_mobile": pagespeed_mobile,
        "pagespeed_desktop": pagespeed_desktop,
        "lcp_score_mobile": median_of(mobile_runs, "lcp"),
        "cls_score_mobile": median_of(mobile_runs, "cls"),
        "lcp_score_desktop": median_of(desktop_runs, "lcp"),
        "cls_score_desktop": median_of(desktop_runs, "cls"),
        "performance_rating": performance_rating,
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "tested_url": demo_url,
        "pagespeed_insights_link": psi_link,
        "_measurement_metadata": {
            "runs_per_strategy": RUNS_PER_STRATEGY,
            "aggregation": "median",
            "raw_runs": raw_runs,
            "variance_score_mobile": variance_mobile,
            "variance_score_desktop": variance_desktop,
            "needs_reverification": needs_reverification,
        },
    }


def build_base_json(candidate: dict, pagespeed_data: dict) -> dict:
    """Build base JSON with _meta + pagespeed_data for a single candidate."""
    return {
        "_meta": {
            "theme_name": candidate.get("theme_name", ""),
            "theme_slug": candidate.get("theme_slug", ""),
            "scrape_date": None,
            "psi_fetch_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "sources": [],
            "data_conflicts": [],
        },
        "marketplace_data": None,
        "author_site_data": None,
        "pagespeed_data": pagespeed_data,
        "additional_ratings": [],
    }


def fetch_batch(validated_path: str, output_dir: str, psi_api_key: str, resume: bool = False) -> dict:
    """
    Fetch PSI data for all pass-validated candidates.

    Returns summary dict.
    """
    validated = json.loads(Path(validated_path).read_text(encoding="utf-8"))
    batch_name = validated.get("_meta", {}).get("batch_name", "unknown")
    logger = _setup_logger(batch_name)

    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    passed = [r for r in validated.get("results", []) if r.get("ready_for_psi_fetch")]
    logger.info(f"Starting PSI fetch for {len(passed)} candidates")

    # Build candidate lookup from input (need theme_name, demo_url)
    # The validated results have theme_slug + checks with demo_url info
    completed = 0
    skipped = 0
    failed = 0

    for result in passed:
        slug = result["theme_slug"]
        out_path = out_dir / f"{slug}.json"

        if resume and out_path.exists():
            logger.info(f"Skipping {slug} (already fetched)")
            skipped += 1
            continue

        demo_url = result["checks"]["demo_url"]["final_url"] or ""
        if not demo_url:
            logger.error(f"No demo URL for {slug}")
            failed += 1
            continue

        # Extract theme_name from slug (best effort)
        theme_name = slug.replace("-", " ").title()

        logger.info(f"--- Measuring: {slug} ({demo_url}) ---")
        pagespeed_data = measure_theme(demo_url, psi_api_key, logger)

        if pagespeed_data["pagespeed_mobile"] == 0 and pagespeed_data["pagespeed_desktop"] == 0:
            logger.error(f"All PSI runs failed for {slug}")
            failed += 1
            continue

        candidate_info = {"theme_name": theme_name, "theme_slug": slug}
        base_json = build_base_json(candidate_info, pagespeed_data)

        # Atomic save
        tmp = out_path.with_suffix(".tmp")
        tmp.write_text(json.dumps(base_json, indent=2, ensure_ascii=False), encoding="utf-8")
        tmp.replace(out_path)

        completed += 1
        variance = pagespeed_data["_measurement_metadata"]["variance_score_mobile"]
        logger.info(f"Completed {slug}: mobile={pagespeed_data['pagespeed_mobile']} "
                    f"desktop={pagespeed_data['pagespeed_desktop']} variance={variance}")

    summary = {
        "batch_name": batch_name,
        "total_passed": len(passed),
        "completed": completed,
        "skipped": skipped,
        "failed": failed,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
    logger.info(f"Batch summary: {json.dumps(summary)}")
    return summary
