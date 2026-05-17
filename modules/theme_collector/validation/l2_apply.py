"""
L2 Apply — reads Claude's L2 verdicts and auto-merges high-confidence disagreements.

Auto-merge rules:
  - verdict=disagree AND confidence>=0.95 AND suggested_value not None -> update JSON
  - verdict=disagree AND confidence<0.95 -> flag for L3
  - verdict=uncertain -> flag for L3
  - verdict=agree -> no action

Safety: max 5 auto-merges per theme. Dry-run default.
"""

import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
VERDICTS_DIR = REPO_ROOT / "data" / "l2-verdicts"
FINAL_DIR = REPO_ROOT / "data" / "cache" / "final"
MERGE_LOG = REPO_ROOT / "data" / "l2-auto-merges.log"

AUTO_MERGE_THRESHOLD = 0.95
MAX_AUTO_MERGES = 5


@dataclass
class ApplyResult:
    theme_slug: str = ""
    dry_run: bool = True
    auto_merged: list = field(default_factory=list)
    flagged_for_l3: list = field(default_factory=list)
    agreed: int = 0
    aborted: bool = False
    abort_reason: str = ""


def apply_l2_verdicts(theme_slug: str, dry_run: bool = True) -> ApplyResult:
    """Read L2 verdicts, auto-merge high-confidence disagreements, flag rest."""
    result = ApplyResult(theme_slug=theme_slug, dry_run=dry_run)

    verdict_path = VERDICTS_DIR / f"{theme_slug}.json"
    if not verdict_path.exists():
        result.aborted = True
        result.abort_reason = f"No L2 verdicts found at {verdict_path}"
        return result

    final_path = FINAL_DIR / f"{theme_slug}.json"
    if not final_path.exists():
        result.aborted = True
        result.abort_reason = f"No final JSON found at {final_path}"
        return result

    verdicts_data = json.loads(verdict_path.read_text(encoding="utf-8"))
    final_json = json.loads(final_path.read_text(encoding="utf-8"))

    verdicts = verdicts_data.get("verdicts", [])
    merge_candidates = []

    for v in verdicts:
        verdict = v.get("verdict", "")
        confidence = v.get("confidence", 0)
        field_path = v.get("field_path", "")

        if verdict == "agree":
            result.agreed += 1
        elif verdict == "disagree" and confidence >= AUTO_MERGE_THRESHOLD and v.get("suggested_value") is not None:
            merge_candidates.append(v)
        else:
            result.flagged_for_l3.append({
                "field_path": field_path,
                "verdict": verdict,
                "confidence": confidence,
                "reasoning": v.get("reasoning", ""),
            })

    # Safety: cap at MAX_AUTO_MERGES
    if len(merge_candidates) > MAX_AUTO_MERGES:
        result.aborted = True
        result.abort_reason = (
            f"{len(merge_candidates)} auto-merge candidates exceed max {MAX_AUTO_MERGES}. "
            "Flagging entire theme for L3 review."
        )
        result.flagged_for_l3.extend([{
            "field_path": v["field_path"],
            "verdict": "disagree",
            "confidence": v["confidence"],
            "reasoning": v.get("reasoning", ""),
        } for v in merge_candidates])
        return result

    # Apply merges
    for v in merge_candidates:
        field_path = v["field_path"]
        old_value = _get_nested(final_json, field_path)
        new_value = v["suggested_value"]

        if not dry_run:
            _set_nested(final_json, field_path, new_value)
            _log_merge(theme_slug, field_path, old_value, new_value, v["confidence"], v.get("reasoning", ""))

        result.auto_merged.append({
            "field_path": field_path,
            "old_value": str(old_value)[:60],
            "new_value": str(new_value)[:60],
            "confidence": v["confidence"],
        })

    # Save updated JSON
    if not dry_run and result.auto_merged:
        # Preserve originals in metadata
        if "_agent_metadata" not in final_json:
            final_json["_agent_metadata"] = {}
        final_json["_agent_metadata"]["l2_auto_merged_fields"] = [m["field_path"] for m in result.auto_merged]
        final_json["_agent_metadata"]["l2_original_values"] = {
            m["field_path"]: m["old_value"] for m in result.auto_merged
        }

        final_path.write_text(json.dumps(final_json, indent=2, ensure_ascii=False), encoding="utf-8")

    return result


def _get_nested(data: dict, path: str):
    """Get value from nested dict by dot-path."""
    keys = path.split(".")
    current = data
    for k in keys:
        if isinstance(current, dict) and k in current:
            current = current[k]
        else:
            return None
    return current


def _set_nested(data: dict, path: str, value):
    """Set value in nested dict by dot-path."""
    keys = path.split(".")
    current = data
    for k in keys[:-1]:
        if k not in current:
            current[k] = {}
        current = current[k]
    current[keys[-1]] = value


def _log_merge(theme_slug, field_path, old_value, new_value, confidence, reasoning):
    """Log auto-merge to audit trail."""
    MERGE_LOG.parent.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.utcnow().isoformat() + "Z"
    excerpt = reasoning[:80].replace("\n", " ") if reasoning else ""
    with open(MERGE_LOG, "a", encoding="utf-8") as f:
        f.write(f"{timestamp} | {theme_slug} | {field_path} | {str(old_value)[:40]} | {str(new_value)[:40]} | {confidence} | {excerpt}\n")
