"""L1 Rule: Source reference integrity — [N] references resolve to valid sources."""

from __future__ import annotations
import re
import json


def _issue(theme, field, severity, msg):
    from ..l1_structural import ValidationIssue
    return ValidationIssue(theme=theme, field_path=field, severity=severity, expected_or_issue=msg)


def _collect_source_ids(data: dict) -> set[str]:
    """Collect all valid source IDs from sources array."""
    sources = data.get("sources_methodology", {}).get("sources", [])
    ids = set()
    for s in sources:
        sid = s.get("source_id", "")
        match = re.search(r"\[(\d+)\]", str(sid))
        if match:
            ids.add(match.group(1))
    return ids


def _find_refs_in_text(text: str) -> set[str]:
    """Find all [N] references in a string."""
    return set(re.findall(r"\[(\d+)\]", str(text)))


def _find_all_refs(data) -> set[str]:
    """Recursively find all [N] references in JSON."""
    refs = set()
    if isinstance(data, dict):
        for v in data.values():
            refs |= _find_all_refs(v)
    elif isinstance(data, list):
        for item in data:
            refs |= _find_all_refs(item)
    elif isinstance(data, str):
        refs |= _find_refs_in_text(data)
    return refs


def check_source_refs(data: dict, theme: str) -> list:
    issues = []

    source_ids = _collect_source_ids(data)
    all_refs = _find_all_refs(data)

    # Remove source_id self-references
    sources_section = json.dumps(data.get("sources_methodology", {}))
    self_refs = _find_refs_in_text(sources_section)

    # Check for orphan references (cited but no source entry)
    orphans = all_refs - source_ids
    if orphans:
        issues.append(_issue(theme, "source_references", "warning",
                             f"Orphan references (no source entry): [{'], ['.join(sorted(orphans, key=int))}]"))

    # Minimum source count
    sources = data.get("sources_methodology", {}).get("sources", [])
    valid_sources = [s for s in sources if s.get("source_url", "").startswith("http")]
    if len(valid_sources) < 5:
        issues.append(_issue(theme, "sources_methodology.sources", "warning",
                             f"Only {len(valid_sources)} valid sources (recommended minimum 5)"))

    # Check source_date populated
    missing_dates = sum(1 for s in sources if not s.get("source_date") or s.get("source_date") == "")
    if missing_dates > 0:
        issues.append(_issue(theme, "sources_methodology.sources.source_date", "warning",
                             f"{missing_dates} source(s) missing source_date"))

    return issues
