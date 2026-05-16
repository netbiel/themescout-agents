"""
Port of Apps Script generateSearchProfile() from v3.20.3.
Pure Python — no LLM. Generates pipe-delimited search profile string.

Format: ThemeName|perf:tier(Xmob,Ydesk)|price:model($Z)|handoff:S/complexity|ideal:a,b|avoid:c,d|tags:...
"""

import json
import re
from pathlib import Path

import yaml

MAPPINGS_PATH = Path(__file__).resolve().parent.parent.parent.parent / "config" / "taxonomy_mappings.yaml"

BUILDER_KEYWORDS = {
    "elementor": "elementor", "wpbakery": "wpbakery", "divi": "divi-builder",
    "bricks": "bricks", "gutenberg": "gutenberg", "beaver": "beaver-builder",
}

SCAN_THRESHOLD = 3

INSTALL_THRESHOLDS = [
    (1_000_000, "1M+installs"),
    (200_000, "200k+installs"),
    (100_000, "100k+installs"),
    (50_000, "50k+installs"),
    (10_000, "10k+installs"),
    (1_000, "1k+installs"),
]

SECURITY_KEYWORDS = [
    "vulnerab", "cve", "exploit", "malware", "backdoor", "xss attack",
    "sql inject", "rce", "csrf attack", "privilege escalat", "zero-day", "0-day",
]


def _get_perf_string(data: dict) -> str:
    pm = data.get("performance_metrics", {})
    mobile = pm.get("pagespeed_mobile", 0) or 0
    desktop = pm.get("pagespeed_desktop", 0) or 0
    tier = (pm.get("performance_tier") or "").lower()
    if not tier:
        if mobile >= 90: tier = "excellent"
        elif mobile >= 70: tier = "good"
        elif mobile >= 50: tier = "needs_work"
        elif mobile > 0: tier = "poor"
        else: return "perf:unknown"
    return f"perf:{tier}({mobile}mob,{desktop}desk)"


def _get_price_string(data: dict) -> str:
    pricing = data.get("theme_pricing", {})
    model = (pricing.get("pricing_model") or "").lower().replace("_", "-")
    price = pricing.get("base_price", 0) or 0
    if model == "free" or price == 0:
        return "price:free"
    if price > 0:
        return f"price:{model}(${price})"
    return f"price:{model}"


def _get_handoff_string(data: dict) -> str:
    hd = data.get("handoff_difficulty", {})
    score = hd.get("handoff_score", 0) or 0
    complexity = (hd.get("handoff_panel_complexity") or "unknown").lower()
    return f"handoff:{score}/{complexity}"


def _get_ideal_avoid(data: dict) -> tuple[str, str]:
    summary = data.get("human_summary", {})
    ideal = summary.get("summary_ideal_for", []) or []
    avoid = summary.get("summary_not_for", []) or []

    def normalize(items, limit):
        result = []
        for item in items[:limit]:
            slug = re.sub(r"[\s/]+", "-", str(item).lower().strip())
            slug = re.sub(r"[^a-z0-9-]", "", slug)
            if slug:
                result.append(slug)
        return result

    ideal_tags = normalize(ideal, 4)
    avoid_tags = normalize(avoid, 3)
    ideal_str = "ideal:" + ",".join(ideal_tags) if ideal_tags else ""
    avoid_str = "avoid:" + ",".join(avoid_tags) if avoid_tags else ""
    return ideal_str, avoid_str


def _get_builder_tags(data: dict, theme_name: str, taxonomy_json: dict) -> list[str]:
    tags = []
    tn = theme_name.lower()

    # Layer 0: theme IS a builder
    for kw, slug in BUILDER_KEYWORDS.items():
        if kw in tn:
            tags.append(slug)

    # Layer 1: plugin compatibility list
    compat_list = data.get("plugin_compatibility_enhanced", {}).get("plugin_compatibility_list", [])
    for plugin in compat_list:
        pname = (plugin.get("plugin") or "").lower()
        cat = (plugin.get("plugin_category") or "").lower()
        status = (plugin.get("compatibility_status") or "").lower()
        if cat != "page_builder":
            continue
        for kw, slug in BUILDER_KEYWORDS.items():
            if kw in pname:
                if slug not in tags and not any(slug in t for t in tags):
                    if status == "none":
                        tags.append(f"{slug}:incompatible")
                    elif status in ("partial", "limited"):
                        tags.append(f"{slug}:partial")
                    else:
                        tags.append(slug)

    # Layer 2: bundled plugins
    for bp in data.get("bundled_plugins", []):
        bcat = (bp.get("plugin_category") or "").lower()
        bname = (bp.get("plugin_name") or "").lower()
        if bcat == "page_builder":
            for kw, slug in BUILDER_KEYWORDS.items():
                if kw in bname and slug not in tags and not any(slug in t for t in tags):
                    tags.append(slug)

    return tags


def _get_distribution_tag(data: dict) -> str:
    dm = (data.get("theme_basic", {}).get("distribution_model") or "themeforest").lower()
    if dm == "wordpress_org":
        return "wordpress-org"
    if dm == "direct_sale":
        return "direct-sale"
    return "themeforest"


def _resolve_architecture_tag(taxonomy_json: dict) -> str:
    mappings = yaml.safe_load(MAPPINGS_PATH.read_text(encoding="utf-8"))
    arch_map = mappings["theme_architecture"]
    arch_ids = taxonomy_json.get("theme_architecture", [])
    for slug, tid in arch_map.items():
        if tid in arch_ids:
            return slug
    return "classic-theme"


def _get_security_tags(data: dict) -> list[str]:
    tags = []
    pain_points = data.get("community_pain_points", {}).get("community_pain_points", [])
    for pp in pain_points:
        title = (pp.get("title") or "").lower()
        desc = (pp.get("description") or "").lower()
        sev = (pp.get("severity") or "").lower()
        text = title + " " + desc
        if "historical" in title or "unconfirmed" in title:
            continue  # skip stale
        for kw in SECURITY_KEYWORDS:
            if kw in text:
                if sev == "critical":
                    tag = "security:critical-historical"
                elif sev == "major":
                    tag = "security:major-historical"
                else:
                    continue
                if tag not in tags:
                    tags.append(tag)
                break
    return tags


def _get_install_tag(data: dict) -> str:
    sales = str(data.get("theme_basic", {}).get("sales_count", "") or "")
    # Parse number from string like "700,000+" or "1M+" or "50000"
    cleaned = re.sub(r"[,+\s]", "", sales.lower())
    if "m" in cleaned:
        cleaned = cleaned.replace("m", "000000")
    if "k" in cleaned:
        cleaned = cleaned.replace("k", "000")
    try:
        count = int(float(cleaned))
    except (ValueError, TypeError):
        return ""
    for threshold, tag in INSTALL_THRESHOLDS:
        if count >= threshold:
            return tag
    return ""


def generate_search_profile(data: dict, theme_name: str, taxonomy_json: dict) -> str:
    """
    Port of generateSearchProfile() from Apps Script v3.20.3.
    Returns pipe-delimited search profile string.
    """
    parts = [theme_name]

    parts.append(_get_perf_string(data))
    parts.append(_get_price_string(data))
    parts.append(_get_handoff_string(data))

    ideal_str, avoid_str = _get_ideal_avoid(data)
    if ideal_str:
        parts.append(ideal_str)
    if avoid_str:
        parts.append(avoid_str)

    # Tags
    tags = []
    tags.extend(_get_builder_tags(data, theme_name, taxonomy_json))
    tags.append(_get_distribution_tag(data))

    # WooCommerce tag
    mappings = yaml.safe_load(MAPPINGS_PATH.read_text(encoding="utf-8"))
    woo_id = mappings["theme_types"]["woocommerce"]
    if woo_id in taxonomy_json.get("theme_types", []):
        tags.append("woocommerce")

    tags.append(_resolve_architecture_tag(taxonomy_json))
    tags.extend(_get_security_tags(data))

    install_tag = _get_install_tag(data)
    if install_tag:
        tags.append(install_tag)

    if tags:
        parts.append("tags:" + ",".join(tags))

    return "|".join(parts)
