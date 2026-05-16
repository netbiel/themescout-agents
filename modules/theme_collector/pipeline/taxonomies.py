"""
Port of Apps Script assignTaxonomies() from v3.20.3.
Pure Python — no LLM. Maps theme data to WordPress term IDs.
"""

import json
import re
from pathlib import Path

import yaml

MAPPINGS_PATH = Path(__file__).resolve().parent.parent.parent.parent / "config" / "taxonomy_mappings.yaml"

_mappings = None


def _load_mappings() -> dict:
    global _mappings
    if _mappings is None:
        _mappings = yaml.safe_load(MAPPINGS_PATH.read_text(encoding="utf-8"))
    return _mappings


def map_theme_types(data: dict) -> list[int]:
    m = _load_mappings()["theme_types"]
    ids = []
    tagline = (data.get("theme_basic", {}).get("theme_tagline", "") or "").lower()
    summary = " ".join(data.get("human_summary", {}).get("summary_paragraphs", [])).lower()
    text = tagline + " " + summary

    compat_list = data.get("plugin_compatibility_enhanced", {}).get("plugin_compatibility_list", [])
    has_woo_full = any(
        "woocommerce" in (p.get("plugin", "")).lower() and p.get("compatibility_status") == "full"
        for p in compat_list
    )

    if "woocommerce theme" in tagline and has_woo_full:
        ids.append(m["woocommerce"])

    niche_kw = ["hotel", "travel", "booking", "real estate", "restaurant", "medical",
                 "education", "church", "automotive", "lawyer", "gym", "fitness", "spa",
                 "wedding", "photography", "music", "magazine"]
    if any(kw in text for kw in niche_kw):
        ids.append(m["niche-specific"])

    if any(kw in text for kw in ["blog", "magazine", "news"]):
        ids.append(m["blog-magazine"])
    if any(kw in text for kw in ["agency", "freelancer"]):
        ids.append(m["agency"])
    if any(kw in text for kw in ["portfolio", "creative"]):
        ids.append(m["creative-portfolio"])
    if any(kw in text for kw in ["corporate", "business"]):
        ids.append(m["corporate"])

    if not ids or "multipurpose" in text:
        ids.append(m["multipurpose"])

    return list(dict.fromkeys(ids))[:2]


def map_pricing_model(data: dict) -> list[int]:
    m = _load_mappings()["pricing_model"]
    pricing = data.get("theme_pricing", {})
    pm = (pricing.get("pricing_model") or "").lower()
    lt = (pricing.get("license_type") or "").lower()
    price = pricing.get("base_price", 0) or 0

    if pm == "free" or lt == "free":
        return [m["free"]]
    if pm == "one_time_purchase" or lt in ("standard_commercial", "lifetime"):
        return [m["one-time"]]
    if pm == "annual_subscription" or lt == "subscription_based":
        return [m["subscription"]]
    if lt == "freemium" or (price == 0 and lt != "free"):
        return [m["freemium"]]
    return [m["premium"]]


def map_handoff_difficulty(data: dict) -> list[int]:
    m = _load_mappings()["handoff_difficulty"]
    score = data.get("handoff_difficulty", {}).get("handoff_score", 0) or 0
    if score >= 8:
        return [m["easy"]]
    if score >= 5:
        return [m["moderate"]]
    if score >= 3:
        return [m["hard"]]
    return [m["very-hard"]]


def map_performance_tier(data: dict) -> list[int]:
    m = _load_mappings()["performance_tier"]
    tier = (data.get("performance_metrics", {}).get("performance_tier") or "").lower()
    if tier in m:
        return [m[tier]]
    mobile = data.get("performance_metrics", {}).get("pagespeed_mobile", 0) or 0
    if mobile >= 90:
        return [m["excellent"]]
    if mobile >= 70:
        return [m["good"]]
    if mobile >= 50:
        return [m["needs_work"]]
    if mobile > 0:
        return [m["poor"]]
    return [m["good"]]


def map_builder_tags(data: dict, theme_name: str = "") -> list[int]:
    m = _load_mappings()["page_builders"]
    ids = []
    tn = theme_name.lower()

    builder_keywords = {
        "elementor": "elementor", "wpbakery": "wpbakery", "divi": "divi-builder",
        "bricks": "bricks", "gutenberg": "gutenberg",
    }

    # Layer 0: theme IS a builder
    for kw, slug in builder_keywords.items():
        if kw in tn:
            ids.append(m[slug])

    # Layer 1: plugin compatibility list
    compat_list = data.get("plugin_compatibility_enhanced", {}).get("plugin_compatibility_list", [])
    for plugin in compat_list:
        pname = (plugin.get("plugin") or "").lower()
        cat = (plugin.get("plugin_category") or "").lower()
        if cat != "page_builder":
            continue
        for kw, slug in builder_keywords.items():
            if kw in pname and m[slug] not in ids:
                ids.append(m[slug])

    # Layer 2: bundled plugins
    for bp in data.get("bundled_plugins", []):
        bcat = (bp.get("plugin_category") or "").lower()
        bname = (bp.get("plugin_name") or "").lower()
        if bcat == "page_builder":
            for kw, slug in builder_keywords.items():
                if kw in bname and m[slug] not in ids:
                    ids.append(m[slug])

    return ids


def map_theme_architecture(data: dict) -> list[int]:
    m = _load_mappings()["theme_architecture"]
    tagline = (data.get("theme_basic", {}).get("theme_tagline", "") or "").lower()
    summary = " ".join(data.get("human_summary", {}).get("summary_paragraphs", [])).lower()
    text = tagline + " " + summary

    fse_kw = ["full site editing", "block theme", "fse theme", "fse-ready", "site editor"]
    if any(kw in text for kw in fse_kw):
        return [m["block-theme-fse"]]

    hybrid_kw = ["hybrid theme", "block support", "classic and block", "hybrid"]
    if any(kw in text for kw in hybrid_kw):
        return [m["hybrid"]]

    return [m["classic-theme"]]


def map_vendor_lock_in(data: dict, theme_name: str = "") -> list[int]:
    m = _load_mappings()["vendor_lock_in"]
    tn = theme_name.lower()
    bundled = data.get("bundled_plugins", [])
    bundled_count = len(bundled)

    has_proprietary = any(
        tn in (bp.get("plugin_name", "")).lower()
        and (bp.get("plugin_category", "")).lower() == "page_builder"
        for bp in bundled
    )

    shortcode_mentions = 0
    pain_text = json.dumps(data.get("community_pain_points", {})).lower()
    praise_text = json.dumps(data.get("community_praise_stats", [])).lower() if "community_praise_stats" in str(data) else ""
    shortcode_mentions = (pain_text + praise_text).count("shortcode")

    if has_proprietary and bundled_count >= 5:
        return [m["critical"]]
    if has_proprietary or bundled_count >= 4 or shortcode_mentions >= 3:
        return [m["high"]]
    if bundled_count >= 2 or shortcode_mentions >= 1:
        return [m["moderate"]]
    return [m["minimal"]]


def map_support_quality(data: dict) -> list[int]:
    m = _load_mappings()["support_quality"]
    pain_points = data.get("community_pain_points", {}).get("community_pain_points", [])
    praise_stats = data.get("community_pain_points", {}).get("community_praise_stats", [])

    complaints = sum(1 for p in pain_points if (p.get("category", "") or "").lower() == "support")
    praise_count = sum(
        1 for p in praise_stats
        if (p.get("category", "") or "").lower() == "support"
        or "support" in (p.get("positive_aspect", "") or "").lower()
    )

    if praise_count >= 2 and complaints == 0:
        return [m["excellent"]]
    if praise_count >= 1 and complaints <= 1:
        return [m["good"]]
    if complaints >= 3:
        return [m["poor"]]
    if complaints >= 1:
        return [m["average"]]
    return [m["unknown"]]


def assign_taxonomies(data: dict, theme_name: str = "") -> dict[str, list[int]]:
    """
    Port of assignTaxonomies() from Apps Script v3.20.3.
    Returns dict of taxonomy_slug -> [term_id_list].
    """
    return {
        "theme_types": map_theme_types(data),
        "pricing_model": map_pricing_model(data),
        "handoff_difficulty": map_handoff_difficulty(data),
        "performance_tier": map_performance_tier(data),
        "page_builders": map_builder_tags(data, theme_name),
        "theme_architecture": map_theme_architecture(data),
        "vendor_lock_in": map_vendor_lock_in(data, theme_name),
        "support_quality": map_support_quality(data),
    }
