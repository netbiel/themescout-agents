"""
Port of Apps Script cleanupOutput() from v3.20.3.
Pure Python — no LLM. Mechanical transformations on Step 3 raw JSON.

Each transformation is a separate function for testability.
"""

import re
import json
from datetime import datetime, timedelta

STALE_DATE_MONTHS = 6
MIN_PAIN_POINTS = 8
MIN_VERDICT_LENGTH = 20
MIN_SOURCES_FOR_FAQ = 5
INVALID_URL_PATTERNS = ["unknown", "n/a", "none", "null", ""]

VALID_PAIN_CATEGORIES = {
    "performance", "handoff", "updates", "plugin_compat", "support", "cost", "general",
}
CATEGORY_MAPPING = {
    "hosting": "general", "server": "general", "development": "general",
    "security": "general", "compatibility": "plugin_compat", "pricing": "cost",
    "documentation": "support",
}

CODE_QUALITY_MAP = {
    "beginner": "basic", "intermediate": "good", "advanced": "high", "expert": "premium",
}


def is_valid_url(url: str) -> bool:
    if not url or not isinstance(url, str):
        return False
    u = url.strip().lower()
    if any(u == p for p in INVALID_URL_PATTERNS):
        return False
    return u.startswith("http://") or u.startswith("https://")


def sanitize_strings(data: dict) -> dict:
    """Trim whitespace, normalize quotes."""
    if isinstance(data, dict):
        return {k: sanitize_strings(v) for k, v in data.items()}
    if isinstance(data, list):
        return [sanitize_strings(v) for v in data]
    if isinstance(data, str):
        return data.strip()
    return data


def normalize_code_quality(data: dict) -> dict:
    cq = data.get("theme_basic", {}).get("code_quality", "")
    if cq and cq.lower() in CODE_QUALITY_MAP:
        data["theme_basic"]["code_quality"] = CODE_QUALITY_MAP[cq.lower()]
    return data


def enforce_scope(data: dict) -> dict:
    """Ensure all pain points and praise have scope field."""
    for pp in data.get("community_pain_points", {}).get("community_pain_points", []):
        if not pp.get("scope"):
            pp["scope"] = "theme"
    for ps in data.get("community_pain_points", {}).get("community_praise_stats", []):
        if not ps.get("scope"):
            ps["scope"] = "theme"
    return data


def validate_categories(data: dict) -> dict:
    """Validate pain point categories against enum."""
    for pp in data.get("community_pain_points", {}).get("community_pain_points", []):
        cat = (pp.get("category") or "").lower()
        if cat in CATEGORY_MAPPING:
            pp["category"] = CATEGORY_MAPPING[cat]
        elif cat not in VALID_PAIN_CATEGORIES:
            pp["category"] = "general"
    return data


def remove_invalid_pain_urls(data: dict) -> dict:
    pps = data.get("community_pain_points", {}).get("community_pain_points", [])
    data["community_pain_points"]["community_pain_points"] = [
        pp for pp in pps if is_valid_url(pp.get("source_url", ""))
    ]
    return data


def _parse_date(date_str: str) -> datetime | None:
    if not date_str or date_str == "date-unknown":
        return None
    try:
        parts = date_str.split("-")
        if len(parts) >= 2:
            return datetime(int(parts[0]), int(parts[1]), 1)
    except (ValueError, IndexError):
        return None
    return None


def detect_stale_by_date(data: dict) -> dict:
    """Downgrade severity for pain points older than STALE_DATE_MONTHS."""
    cutoff = datetime.now() - timedelta(days=STALE_DATE_MONTHS * 30)
    severity_chain = {"critical": "major", "major": "moderate", "moderate": "minor"}

    for pp in data.get("community_pain_points", {}).get("community_pain_points", []):
        date = _parse_date(pp.get("date_reported", ""))
        if date and date < cutoff:
            old_sev = (pp.get("severity") or "").lower()
            if old_sev in severity_chain:
                pp["severity"] = severity_chain[old_sev]
            title = pp.get("title", "")
            if "(historical" not in title:
                pp["title"] = title + " (historical — unconfirmed current)"
    return data


def remove_invalid_praise(data: dict) -> dict:
    praise = data.get("community_pain_points", {}).get("community_praise_stats", [])
    data["community_pain_points"]["community_praise_stats"] = [
        p for p in praise if is_valid_url(p.get("source_url", ""))
    ]
    return data


def generate_fallback_praise(data: dict) -> dict:
    """Generate fallback praise if fewer than 3 praise points."""
    praise = data.get("community_pain_points", {}).get("community_praise_stats", [])
    if len(praise) >= 3:
        return data

    existing_cats = {(p.get("category") or "").lower() for p in praise}
    fallbacks = []

    # Sales count praise
    sales = str(data.get("theme_basic", {}).get("sales_count", "") or "")
    sales_num = int(re.sub(r"[^0-9]", "", sales) or 0)
    if sales_num >= 50000 and "marketplace" not in existing_cats:
        fallbacks.append({"category": "marketplace", "positive_aspect": f"Strong market adoption with {sales} downloads/sales",
                          "strength": "high", "title": "Market popularity", "description": f"{sales} total sales/installs indicates strong community trust.",
                          "frequency": "verified", "scope": "theme", "sentiment": "positive", "source": "Marketplace data", "source_url": "", "percentage": 0})

    # Rating praise
    ratings = data.get("theme_ratings", {}).get("external_ratings", [])
    for r in ratings:
        score = r.get("rating_score", 0) or 0
        if score >= 4.5 and "marketplace" not in existing_cats and "marketplace" not in {f.get("category") for f in fallbacks}:
            fallbacks.append({"category": "marketplace", "positive_aspect": f"High rating ({score}/5)",
                              "strength": "high", "title": "User satisfaction", "description": f"Rating of {score}/5 from {r.get('rating_source', 'marketplace')}.",
                              "frequency": "verified", "scope": "theme", "sentiment": "positive", "source": r.get("rating_source", ""), "source_url": r.get("rating_url", ""), "percentage": 0})

    # Performance praise
    mobile = data.get("performance_metrics", {}).get("pagespeed_mobile", 0) or 0
    if mobile >= 90 and "performance" not in existing_cats and "performance" not in {f.get("category") for f in fallbacks}:
        fallbacks.append({"category": "performance", "positive_aspect": f"Excellent PageSpeed score ({mobile}/100 mobile)",
                          "strength": "high", "title": "Performance excellence", "description": f"Mobile PageSpeed of {mobile}/100 indicates excellent optimization.",
                          "frequency": "verified", "scope": "theme", "sentiment": "positive", "source": "PageSpeed Insights", "source_url": "", "percentage": 0})

    needed = 3 - len(praise)
    praise.extend(fallbacks[:needed])
    data["community_pain_points"]["community_praise_stats"] = praise
    return data


def cleanup_plugin_compat(data: dict, theme_name: str = "") -> dict:
    """Remove invalid plugin entries, companion plugins, PHP versions."""
    tn = theme_name.lower()
    plugins = data.get("plugin_compatibility_enhanced", {}).get("plugin_compatibility_list", [])
    bundled_names = {(bp.get("plugin_name") or "").lower() for bp in data.get("bundled_plugins", [])}

    cleaned = []
    for p in plugins:
        pname = (p.get("plugin") or "").lower()
        status = (p.get("compatibility_status") or "").lower()
        if status in ("untested", "unknown"):
            continue
        if "php" in pname and "version" in pname:
            continue
        if tn and pname.startswith(tn):
            continue
        if pname in bundled_names:
            continue
        cleaned.append(p)

    # Recalculate stats
    data["plugin_compatibility_enhanced"]["plugin_compatibility_list"] = cleaned
    data["plugin_compatibility_enhanced"]["compat_total_tested"] = len(cleaned)
    data["plugin_compatibility_enhanced"]["compat_full_compatible"] = sum(
        1 for p in cleaned if (p.get("compatibility_status") or "").lower() == "full"
    )
    data["plugin_compatibility_enhanced"]["compat_issues_found"] = sum(
        1 for p in cleaned if (p.get("compatibility_status") or "").lower() != "full"
    )
    return data


def clean_short_verdicts(data: dict) -> dict:
    """Remove verdicts shorter than MIN_VERDICT_LENGTH words."""
    verdict_fields = [
        ("handoff_difficulty", ["handoff_verdict_safe", "handoff_verdict_caution", "handoff_verdict_avoid"]),
        ("scenario_performance", ["perf_verdict_safe", "perf_verdict_caution", "perf_verdict_avoid"]),
        ("scenario_updates", ["updates_verdict_safe", "updates_verdict_caution", "updates_verdict_avoid"]),
        ("plugin_compatibility_enhanced", ["compat_verdict_safe", "compat_verdict_caution", "compat_verdict_avoid"]),
    ]
    for section, fields in verdict_fields:
        sec_data = data.get(section, {})
        for field in fields:
            val = sec_data.get(field, "")
            if val and len(val.split()) < MIN_VERDICT_LENGTH:
                sec_data[field] = ""
    return data


def validate_performance_consistency(data: dict) -> dict:
    """Ensure perf_verdict_safe is empty when pagespeed_mobile < 50."""
    mobile = data.get("performance_metrics", {}).get("pagespeed_mobile", 0) or 0
    if mobile < 50:
        data.get("scenario_performance", {})["perf_verdict_safe"] = ""
    return data


def fix_handoff_score(data: dict) -> dict:
    """Recalculate handoff_score from enums."""
    hd = data.get("handoff_difficulty", {})
    weights_panel = {"minimal": 0, "moderate": 1, "complex": 2, "overwhelming": 3}
    weights_docs = {"excellent": 0, "good": 1, "basic": 2, "poor": 3}
    weights_curve = {"minutes": 0, "hours": 1, "days": 2, "weeks": 3}

    panel = weights_panel.get((hd.get("handoff_panel_complexity") or "").lower(), 2)
    docs = weights_docs.get((hd.get("handoff_docs_quality") or "").lower(), 2)
    curve = weights_curve.get((hd.get("handoff_learning_curve") or "").lower(), 2)

    score = max(1, min(10, 10 - (panel + docs + curve)))
    hd["handoff_score"] = score
    return data


def remove_nulls(data):
    """Replace null values with empty strings or 0."""
    if isinstance(data, dict):
        return {k: remove_nulls(v) for k, v in data.items()}
    if isinstance(data, list):
        return [remove_nulls(v) for v in data]
    if data is None:
        return ""
    return data


def clear_faq_if_few_sources(data: dict) -> dict:
    sources = data.get("sources_methodology", {}).get("sources", [])
    valid = [s for s in sources if is_valid_url(s.get("source_url", ""))]
    if len(valid) < MIN_SOURCES_FOR_FAQ:
        data.get("faq", {})["faq_items"] = []
    return data


def cleanup_output(raw_json: dict, theme_name: str = "", taxonomy_json: dict | None = None) -> dict:
    """
    Port of Apps Script cleanupOutput() v3.20.3.
    Applies all transformations in sequence.
    """
    data = json.loads(json.dumps(raw_json))  # deep copy

    data = sanitize_strings(data)
    data = normalize_code_quality(data)
    data = enforce_scope(data)
    data = validate_categories(data)
    data = remove_invalid_pain_urls(data)
    data = detect_stale_by_date(data)
    data = remove_invalid_praise(data)
    data = generate_fallback_praise(data)
    data = cleanup_plugin_compat(data, theme_name)
    data = clear_faq_if_few_sources(data)
    data = clean_short_verdicts(data)
    data = validate_performance_consistency(data)
    data = fix_handoff_score(data)
    data = remove_nulls(data)

    return data
