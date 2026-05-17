"""L1 Rule: Plugin compatibility cross-references."""

from __future__ import annotations


def _issue(theme, field, severity, msg):
    from ..l1_structural import ValidationIssue
    return ValidationIssue(theme=theme, field_path=field, severity=severity, expected_or_issue=msg)


def check_plugin_compat(data: dict, theme: str) -> list:
    issues = []

    plugins = data.get("plugin_compatibility_enhanced", {}).get("plugin_compatibility_list", [])
    plugin_names = {(p.get("plugin") or "").lower() for p in plugins}
    bundled_names = {(bp.get("plugin_name") or "").lower() for bp in data.get("bundled_plugins", [])}

    # Cross-ref: plugins mentioned in pain points must be in compat list
    pain_points = data.get("community_pain_points", {}).get("community_pain_points", [])
    for pp in pain_points:
        title = (pp.get("title") or "").lower()
        desc = (pp.get("description") or "").lower()
        text = title + " " + desc

        known_plugins = ["woocommerce", "elementor", "yoast", "acf", "wpml", "wpbakery",
                         "divi", "beaver builder", "bricks", "rank math", "wp rocket",
                         "w3 total cache", "litespeed", "contact form 7", "gravity forms"]
        for kp in known_plugins:
            if kp in text and kp not in plugin_names and kp not in bundled_names:
                issues.append(_issue(theme, f"plugin_compatibility_list", "error",
                                     f"Plugin '{kp}' mentioned in pain point but not in plugin_compatibility_list"))

    # Valid status values
    valid_statuses = {"full", "partial", "limited", "none", "previously_reported"}
    for p in plugins:
        status = (p.get("compatibility_status") or "").lower()
        if status and status not in valid_statuses:
            issues.append(_issue(theme, f"plugin_compatibility_list.{p.get('plugin', '?')}", "warning",
                                 f"Invalid compatibility_status: '{status}'"))

    # Builder in compat list should be in search_profile
    sp = (data.get("search_profile") or "").lower()
    builders = {"elementor", "wpbakery", "divi", "bricks", "gutenberg"}
    for p in plugins:
        pcat = (p.get("plugin_category") or "").lower()
        pname = (p.get("plugin") or "").lower()
        if pcat == "page_builder":
            for builder in builders:
                if builder in pname and builder not in sp:
                    issues.append(_issue(theme, f"search_profile.builder_tag", "error",
                                         f"Builder '{builder}' in compat_list but missing from search_profile"))

    return issues
