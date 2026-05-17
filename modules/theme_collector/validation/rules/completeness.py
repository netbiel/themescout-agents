"""L1 Rule: Completeness — required fields present, minimums met."""

from __future__ import annotations
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from ..l1_structural import ValidationIssue


def _issue(theme, field, severity, msg):
    from ..l1_structural import ValidationIssue
    return ValidationIssue(theme=theme, field_path=field, severity=severity, expected_or_issue=msg)


def check_completeness(data: dict, theme: str) -> list:
    issues = []

    # Required top-level sections
    required = [
        "quick_overview", "theme_basic", "performance_metrics", "theme_pricing",
        "handoff_difficulty", "scenario_performance", "scenario_updates",
        "plugin_compatibility_enhanced", "community_pain_points", "faq",
        "human_summary", "sources_methodology",
    ]
    for section in required:
        if section not in data or not data[section]:
            issues.append(_issue(theme, section, "error", f"Required section '{section}' missing or empty"))

    # Required string fields
    basic = data.get("theme_basic", {})
    for field in ["theme_version", "last_update", "sales_count", "distribution_model", "demo_url"]:
        val = basic.get(field, "")
        if not val or not str(val).strip():
            issues.append(_issue(theme, f"theme_basic.{field}", "warning", f"Empty required field"))

    # Pain points minimum
    pps = data.get("community_pain_points", {}).get("community_pain_points", [])
    if len(pps) < 8:
        issues.append(_issue(theme, "community_pain_points", "warning",
                             f"Only {len(pps)} pain points (minimum 8 required)"))

    # Praise minimum
    praise = data.get("community_pain_points", {}).get("community_praise_stats", [])
    if len(praise) < 3:
        issues.append(_issue(theme, "community_praise_stats", "warning",
                             f"Only {len(praise)} praise points (minimum 3 required)"))

    # External ratings
    ratings = data.get("theme_ratings", {}).get("external_ratings", [])
    if not ratings:
        issues.append(_issue(theme, "theme_ratings.external_ratings", "warning", "No external ratings"))

    # Verdict lengths
    verdict_sections = [
        ("handoff_difficulty", ["handoff_verdict_safe", "handoff_verdict_caution", "handoff_verdict_avoid"]),
        ("scenario_performance", ["perf_verdict_safe", "perf_verdict_caution", "perf_verdict_avoid"]),
        ("scenario_updates", ["updates_verdict_safe", "updates_verdict_caution", "updates_verdict_avoid"]),
        ("plugin_compatibility_enhanced", ["compat_verdict_safe", "compat_verdict_caution", "compat_verdict_avoid"]),
    ]
    for section, fields in verdict_sections:
        sec = data.get(section, {})
        for field in fields:
            val = sec.get(field, "")
            if val and len(val.split()) < 20:
                issues.append(_issue(theme, f"{section}.{field}", "warning",
                                     f"Verdict too short ({len(val.split())} words, min 20)"))

    # Summary recommendation
    sr = data.get("human_summary", {}).get("summary_recommendation", "")
    if not sr or not sr.strip():
        issues.append(_issue(theme, "human_summary.summary_recommendation", "warning", "Empty recommendation"))

    return issues
