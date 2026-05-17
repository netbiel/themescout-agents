"""L1 Rule: search_profile parses correctly and matches data."""

from __future__ import annotations
import re


def _issue(theme, field, severity, msg):
    from ..l1_structural import ValidationIssue
    return ValidationIssue(theme=theme, field_path=field, severity=severity, expected_or_issue=msg)


def check_search_profile(data: dict, theme: str, taxonomy: dict | None = None) -> list:
    issues = []

    sp = data.get("search_profile", "")
    if not sp or not sp.strip():
        issues.append(_issue(theme, "search_profile", "error", "search_profile is empty"))
        return issues

    parts = sp.split("|")
    if len(parts) < 3:
        issues.append(_issue(theme, "search_profile", "error",
                             f"search_profile has only {len(parts)} segments (expected 4+)"))
        return issues

    # Parse perf tag
    perf_match = re.search(r"perf:(\w+)\((\d+)mob", sp)
    if perf_match:
        sp_tier = perf_match.group(1)
        sp_mobile = int(perf_match.group(2))
        actual_mobile = data.get("performance_metrics", {}).get("pagespeed_mobile", 0) or 0
        actual_tier = (data.get("performance_metrics", {}).get("performance_tier") or "").lower()

        if actual_mobile > 0 and sp_mobile != actual_mobile:
            issues.append(_issue(theme, "search_profile.perf", "error",
                                 f"search_profile mobile={sp_mobile} but JSON has {actual_mobile}"))
        if actual_tier and sp_tier != actual_tier:
            issues.append(_issue(theme, "search_profile.perf_tier", "error",
                                 f"search_profile tier={sp_tier} but JSON has {actual_tier}"))

    # Parse handoff tag
    handoff_match = re.search(r"handoff:(\d+)/", sp)
    if handoff_match:
        sp_score = int(handoff_match.group(1))
        actual_score = data.get("handoff_difficulty", {}).get("handoff_score", 0) or 0
        if actual_score > 0 and sp_score != actual_score:
            issues.append(_issue(theme, "search_profile.handoff", "error",
                                 f"search_profile handoff={sp_score} but JSON has {actual_score}"))

    # Check architecture tag
    arch_tags = ["block-theme-fse", "classic-theme", "hybrid"]
    has_arch = any(t in sp for t in arch_tags)
    if not has_arch:
        issues.append(_issue(theme, "search_profile.architecture", "warning",
                             "No architecture tag found in search_profile"))

    # Check old slug format
    if "classic" in sp and "classic-theme" not in sp:
        issues.append(_issue(theme, "search_profile.architecture", "error",
                             "Old slug 'classic' found — should be 'classic-theme'"))
    if "block-fse" in sp and "block-theme-fse" not in sp:
        issues.append(_issue(theme, "search_profile.architecture", "error",
                             "Old slug 'block-fse' found — should be 'block-theme-fse'"))

    return issues
