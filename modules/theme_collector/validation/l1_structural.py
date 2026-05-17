"""
L1 Structural Validation — port of Apps Script validateThemeJSON().
Automatic, deterministic checks run after every cleanup_output().

Severity:
  - error: blocks WP import
  - warning: imports but flagged for review
  - info: informational only
"""

import json
import re
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Literal

from .rules.completeness import check_completeness
from .rules.cross_field import check_cross_field
from .rules.source_refs import check_source_refs
from .rules.search_profile import check_search_profile
from .rules.plugin_compat import check_plugin_compat
from .rules.score_derivation import check_score_derivation


@dataclass
class ValidationIssue:
    theme: str
    field_path: str
    severity: Literal["error", "warning", "info"]
    layer: Literal["L1"] = "L1"
    current_value: str | None = None
    expected_or_issue: str = ""
    source_to_verify: str | None = None
    ai_verdict: str | None = None
    human_decision: str | None = None
    notes: str | None = None


def validate_theme_json(
    theme_json: dict,
    theme_name: str = "",
    taxonomy: dict | None = None,
) -> list[ValidationIssue]:
    """Run all L1 rule modules. Returns combined list of issues."""
    issues = []
    issues.extend(check_completeness(theme_json, theme_name))
    issues.extend(check_cross_field(theme_json, theme_name))
    issues.extend(check_source_refs(theme_json, theme_name))
    issues.extend(check_search_profile(theme_json, theme_name, taxonomy))
    issues.extend(check_plugin_compat(theme_json, theme_name))
    issues.extend(check_score_derivation(theme_json, theme_name))
    return issues


def run_and_save(theme_json: dict, theme_slug: str, taxonomy: dict | None = None) -> dict:
    """Run L1, save results, return summary."""
    issues = validate_theme_json(theme_json, theme_slug, taxonomy)

    errors = sum(1 for i in issues if i.severity == "error")
    warnings = sum(1 for i in issues if i.severity == "warning")
    info = sum(1 for i in issues if i.severity == "info")

    result = {
        "theme_slug": theme_slug,
        "validated_at": datetime.utcnow().isoformat() + "Z",
        "summary": {
            "errors": errors,
            "warnings": warnings,
            "info": info,
            "blocks_import": errors > 0,
        },
        "issues": [asdict(i) for i in issues],
    }

    output_dir = Path(__file__).resolve().parent.parent.parent.parent / "data" / "cache" / "validation"
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / f"l1-{theme_slug}.json").write_text(
        json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    return result
