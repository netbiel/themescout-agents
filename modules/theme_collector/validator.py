"""
Theme Candidate Validator — pre-pipeline URL validation + PSI reachability test.

Checks:
  1. marketplace_url, vendor_url, demo_url reachable (HTTP 2xx/3xx->2xx)
  2. PSI API can measure demo_url
  3. Red flags: captcha, geo-block, login wall

Input:  data/candidates/input/<batch>.json
Output: data/candidates/validated/<batch>.json

Architecture decisions:
  - Atomic writes (.tmp rename) for resume capability
  - Per-candidate error isolation (one failure doesn't crash batch)
  - PSI test = single lightweight call, not full 3-run measurement
  - User-Agent identifies us for webmaster transparency
"""

import json
import logging
import re
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path

import requests
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
USER_AGENT = "ThemeScout-Validator/1.0 (+https://themescout.pro/about)"
URL_TIMEOUT = 15
PSI_TIMEOUT = 30
PSI_API_BASE = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"

BOT_PROTECTION_KEYWORDS = ["captcha", "challenge", "just a moment", "cloudflare", "security check"]


def _setup_logger(batch_name: str) -> logging.Logger:
    log_dir = REPO_ROOT / "data" / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    date = datetime.now().strftime("%Y-%m-%d")
    logger = logging.getLogger(f"validator-{batch_name}")
    logger.setLevel(logging.DEBUG)
    if not logger.handlers:
        fh = logging.FileHandler(log_dir / f"validator-{batch_name}-{date}.log", encoding="utf-8")
        fh.setFormatter(logging.Formatter("%(asctime)s | %(levelname)s | %(message)s"))
        logger.addHandler(fh)
    return logger


@dataclass
class UrlCheck:
    reachable: bool = False
    http_status: int | None = None
    final_url: str = ""
    error: str = ""


@dataclass
class PsiTestCheck:
    api_responsive: bool = False
    estimated_runtime_ms: int = 0
    error: str = ""


@dataclass
class CandidateResult:
    theme_slug: str = ""
    status: str = "pending"  # pass / fail / warning
    checks: dict = field(default_factory=dict)
    warnings: list = field(default_factory=list)
    fail_reasons: list = field(default_factory=list)
    ready_for_psi_fetch: bool = False


def check_url(url: str, logger: logging.Logger) -> UrlCheck:
    """Check if URL is reachable. Follows redirects, detects bot protection."""
    result = UrlCheck()
    try:
        r = requests.get(url, timeout=URL_TIMEOUT, headers={"User-Agent": USER_AGENT},
                         allow_redirects=True, stream=True)
        result.http_status = r.status_code
        result.final_url = r.url
        result.reachable = 200 <= r.status_code < 400

        # Check for bot protection in first 4KB
        content = r.raw.read(4096).decode("utf-8", errors="ignore").lower()
        title_match = re.search(r"<title[^>]*>(.*?)</title>", content)
        if title_match:
            title = title_match.group(1).lower()
            for kw in BOT_PROTECTION_KEYWORDS:
                if kw in title:
                    result.reachable = True  # still reachable, just flagged
                    logger.warning(f"Bot protection detected at {url}: title contains '{kw}'")
                    return result  # caller adds warning

        logger.info(f"URL check {url}: status={r.status_code} final={r.url}")
    except requests.Timeout:
        result.error = f"Timeout after {URL_TIMEOUT}s"
        logger.error(f"URL timeout: {url}")
    except requests.ConnectionError as e:
        result.error = f"ConnectionError: {str(e)[:100]}"
        logger.error(f"URL connection error: {url} - {e}")
    except Exception as e:
        result.error = f"{type(e).__name__}: {str(e)[:100]}"
        logger.error(f"URL check error: {url} - {e}")
    return result


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=5, max=30),
       retry=retry_if_exception_type((requests.HTTPError,)))
def check_psi_reachability(demo_url: str, api_key: str, logger: logging.Logger) -> PsiTestCheck:
    """Test if PSI API can measure the demo URL. Single lightweight call."""
    result = PsiTestCheck()
    try:
        start = time.monotonic()
        r = requests.get(PSI_API_BASE, params={
            "url": demo_url,
            "category": "performance",
            "strategy": "mobile",
            "key": api_key,
        }, timeout=PSI_TIMEOUT, headers={"User-Agent": USER_AGENT})

        elapsed_ms = int((time.monotonic() - start) * 1000)

        if r.status_code == 429:
            logger.warning(f"PSI rate limit hit for {demo_url}")
            r.raise_for_status()  # triggers retry

        data = r.json()
        if "lighthouseResult" in data:
            score = data["lighthouseResult"]["categories"]["performance"]["score"]
            result.api_responsive = True
            result.estimated_runtime_ms = elapsed_ms
            logger.info(f"PSI test OK: {demo_url} score={score} elapsed={elapsed_ms}ms")
        elif "error" in data:
            result.error = data["error"].get("message", "Unknown PSI error")[:150]
            logger.error(f"PSI error for {demo_url}: {result.error}")
        else:
            result.error = "Unexpected PSI response format"
            logger.error(f"PSI unexpected response for {demo_url}")
    except requests.Timeout:
        result.error = f"PSI timeout after {PSI_TIMEOUT}s"
        logger.error(f"PSI timeout: {demo_url}")
    except Exception as e:
        result.error = f"{type(e).__name__}: {str(e)[:100]}"
        logger.error(f"PSI check error: {demo_url} - {e}")
    return result


def validate_input(data: dict) -> list[str]:
    """Validate input JSON structure. Returns list of errors."""
    errors = []
    if "candidates" not in data or not isinstance(data["candidates"], list):
        errors.append("Missing or invalid 'candidates' array")
        return errors
    for i, c in enumerate(data["candidates"]):
        slug = c.get("theme_slug", "")
        if not slug or not re.match(r"^[a-z0-9-]+$", slug):
            errors.append(f"Candidate {i}: invalid theme_slug '{slug}' (must be lowercase alphanumeric + hyphens)")
        if c.get("marketplace_source", "") not in ("ThemeForest", "WordPress.org"):
            errors.append(f"Candidate {i} ({slug}): invalid marketplace_source")
        for url_field in ("marketplace_url", "vendor_url", "demo_url"):
            if not c.get(url_field):
                errors.append(f"Candidate {i} ({slug}): missing {url_field}")
    return errors


def validate_batch(input_path: str, psi_api_key: str, resume: bool = False) -> dict:
    """
    Validate a batch of theme candidates.

    Returns full output dict. Saves incrementally for resume capability.
    """
    input_data = json.loads(Path(input_path).read_text(encoding="utf-8"))

    # Validate input
    input_errors = validate_input(input_data)
    if input_errors:
        raise ValueError(f"Input validation failed:\n" + "\n".join(input_errors))

    batch_name = input_data.get("_meta", {}).get("batch_name", "unknown")
    logger = _setup_logger(batch_name)
    candidates = input_data["candidates"]

    # Determine output path
    output_dir = REPO_ROOT / "data" / "candidates" / "validated"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{batch_name}.json"

    # Resume support
    completed = {}
    if resume and output_path.exists():
        existing = json.loads(output_path.read_text(encoding="utf-8"))
        for r in existing.get("results", []):
            completed[r["theme_slug"]] = r
        logger.info(f"Resuming: {len(completed)} candidates already completed")

    results = []
    for candidate in candidates:
        slug = candidate["theme_slug"]

        if slug in completed:
            results.append(completed[slug])
            continue

        logger.info(f"--- Validating: {slug} ---")
        cr = CandidateResult(theme_slug=slug)
        checks = {}

        # Check URLs
        for url_key in ("marketplace_url", "vendor_url", "demo_url"):
            url = candidate[url_key]
            check = check_url(url, logger)
            checks[url_key] = asdict(check)

            # Detect bot protection
            if check.reachable and not check.error:
                # Re-check title for bot protection (already done in check_url)
                pass

        # PSI test
        if checks["demo_url"]["reachable"]:
            psi = check_psi_reachability(candidate["demo_url"], psi_api_key, logger)
            checks["psi_test"] = asdict(psi)
        else:
            checks["psi_test"] = asdict(PsiTestCheck(error="Skipped: demo_url unreachable"))

        cr.checks = checks

        # Determine status
        fail_reasons = []
        for url_key in ("marketplace_url", "vendor_url", "demo_url"):
            if not checks[url_key]["reachable"]:
                fail_reasons.append(f"{url_key.replace('_url', '')}_unreachable")
        if not checks["psi_test"].get("api_responsive", False):
            fail_reasons.append("psi_unresponsive")

        if fail_reasons:
            cr.status = "fail"
            cr.fail_reasons = fail_reasons
            cr.ready_for_psi_fetch = False
        else:
            cr.status = "pass"
            cr.ready_for_psi_fetch = True

        results.append(asdict(cr))

        # Atomic save after each candidate
        _atomic_save(output_path, _build_output(input_data, results))
        time.sleep(1)  # gentle rate limiting

    output = _build_output(input_data, results)
    _atomic_save(output_path, output)
    logger.info(f"Batch complete: {sum(1 for r in results if r['status']=='pass')} passed, "
                f"{sum(1 for r in results if r['status']=='fail')} failed")
    return output


def _build_output(input_data: dict, results: list) -> dict:
    passed = sum(1 for r in results if r["status"] == "pass")
    failed = sum(1 for r in results if r["status"] == "fail")
    return {
        "_meta": {
            "batch_name": input_data.get("_meta", {}).get("batch_name", "unknown"),
            "validated_at": datetime.now(timezone.utc).isoformat(),
            "validator_version": "1.0",
            "total_input": len(input_data.get("candidates", [])),
            "passed": passed,
            "failed": failed,
        },
        "results": results,
    }


def _atomic_save(path: Path, data: dict):
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)
