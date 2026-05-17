"""L1 Rule: Cross-field consistency checks."""

from __future__ import annotations


def _issue(theme, field, severity, msg):
    from ..l1_structural import ValidationIssue
    return ValidationIssue(theme=theme, field_path=field, severity=severity, expected_or_issue=msg)


def check_cross_field(data: dict, theme: str) -> list:
    issues = []

    # Performance tier vs pagespeed_mobile
    pm = data.get("performance_metrics", {})
    mobile = pm.get("pagespeed_mobile", 0) or 0
    tier = (pm.get("performance_tier") or "").lower()
    if mobile > 0 and tier:
        expected = "poor"
        if mobile >= 90: expected = "excellent"
        elif mobile >= 70: expected = "good"
        elif mobile >= 50: expected = "needs_work"
        if tier != expected:
            issues.append(_issue(theme, "performance_metrics.performance_tier", "error",
                                 f"Tier '{tier}' doesn't match mobile score {mobile} (expected '{expected}')"))

    # perf_verdict_safe must be empty if mobile < 50
    if mobile > 0 and mobile < 50:
        safe = data.get("scenario_performance", {}).get("perf_verdict_safe", "")
        if safe and safe.strip():
            issues.append(_issue(theme, "scenario_performance.perf_verdict_safe", "warning",
                                 f"perf_verdict_safe should be empty when mobile score < 50 (is {mobile})"))

    # Handoff consistency: weeks curve -> complex/overwhelming panel
    hd = data.get("handoff_difficulty", {})
    curve = (hd.get("handoff_learning_curve") or "").lower()
    panel = (hd.get("handoff_panel_complexity") or "").lower()
    if curve == "weeks" and panel not in ("complex", "overwhelming"):
        issues.append(_issue(theme, "handoff_difficulty", "warning",
                             f"learning_curve=weeks but panel_complexity={panel} (expected complex/overwhelming)"))
    if curve == "minutes" and panel in ("complex", "overwhelming"):
        issues.append(_issue(theme, "handoff_difficulty", "warning",
                             f"learning_curve=minutes but panel_complexity={panel} (expected minimal/moderate)"))

    # Distribution model attribution
    dm = (data.get("theme_basic", {}).get("distribution_model") or "").lower()
    if dm in ("wordpress_org", "direct_sale"):
        sources = data.get("sources_methodology", {}).get("sources", [])
        for s in sources:
            url = (s.get("source_url") or "").lower()
            if "themeforest.net" in url:
                issues.append(_issue(theme, "sources_methodology.sources", "error",
                                     f"Distribution is '{dm}' but source references ThemeForest: {url}"))
                break

    # Compat status consistency with notes
    plugins = data.get("plugin_compatibility_enhanced", {}).get("plugin_compatibility_list", [])
    for p in plugins:
        status = (p.get("compatibility_status") or "").lower()
        notes = (p.get("compatibility_notes") or "").lower()
        user_issues = p.get("user_issues", [])
        if status == "full" and user_issues and any(str(u).strip() for u in user_issues):
            issues.append(_issue(theme, f"plugin_compatibility_list.{p.get('plugin', '?')}", "warning",
                                 f"Status 'full' but has user_issues — should be 'partial'?"))

    return issues
