"""
Port of Apps Script importToWP() from v3.20.3.
Imports theme JSON to WordPress via REST API.

Safety: dry_run=True by default. Must explicitly pass dry_run=False.
"""

import json
from dataclasses import dataclass, field
from pathlib import Path

from .client import WordPressClient

VALIDATION_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "cache" / "validation"


class ImportBlocked(Exception):
    pass


@dataclass
class ImportResult:
    success: bool = False
    dry_run: bool = True
    fields_written: int = 0
    skipped_fields: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    post_id: int = 0
    theme_slug: str = ""


def import_theme_to_wp(
    theme_slug: str,
    final_json: dict,
    wp_client: WordPressClient,
    post_id: int,
    dry_run: bool = True,
    skip_validation: bool = False,
) -> ImportResult:
    """
    Import theme JSON to WordPress.

    On dry_run=True: validates payload structure, does NOT POST.
    On dry_run=False: sends POST to /wpagent/v1/theme-profile/import.
    """
    result = ImportResult(
        dry_run=dry_run,
        post_id=post_id,
        theme_slug=theme_slug,
    )

    # Check L1 validation
    if not skip_validation:
        l1_path = VALIDATION_DIR / f"l1-{theme_slug}.json"
        if l1_path.exists():
            l1 = json.loads(l1_path.read_text(encoding="utf-8"))
            if l1["summary"]["blocks_import"]:
                raise ImportBlocked(
                    f"L1 validation has {l1['summary']['errors']} error(s). "
                    "Fix issues or use --skip-validation to override."
                )

    # Validate payload
    if not final_json:
        result.errors.append("Empty JSON payload")
        return result

    if not post_id or post_id <= 0:
        result.errors.append(f"Invalid post_id: {post_id}")
        return result

    required_sections = ["quick_overview", "theme_basic", "community_pain_points", "sources_methodology"]
    for section in required_sections:
        if section not in final_json:
            result.errors.append(f"Missing required section: {section}")

    if result.errors:
        return result

    # Inject agent metadata
    final_json["_agent_generated"] = True
    final_json["_agent_confidence"] = 0.8
    final_json["_agent_sources"] = ["python-pipeline"]

    if dry_run:
        result.success = True
        result.fields_written = len(final_json)
        return result

    # Actual import
    try:
        response = wp_client.import_theme_profile(post_id, final_json)
        result.success = response.get("success", False)
        result.fields_written = response.get("written_count", 0) or response.get("fields_written", 0)
        result.skipped_fields = [s.get("json_key", "") for s in response.get("skipped", [])]
        if not result.success and "error" in response:
            result.errors.append(response["error"])
    except Exception as e:
        result.errors.append(str(e))

    return result
