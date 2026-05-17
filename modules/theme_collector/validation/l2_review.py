"""
L2 Editorial Review — generates artifact for Claude Code session review.

NOT automated. Generates a markdown file that Claude reads during interactive session.
"""

import json
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
PENDING_DIR = REPO_ROOT / "data" / "pending-review"
CACHE_DIR = REPO_ROOT / "data" / "cache"


def generate_review_artifact(theme_slug: str) -> str:
    """Generate L2 review artifact markdown. Returns path to artifact."""
    final_path = CACHE_DIR / "final" / f"{theme_slug}.json"
    l1_path = CACHE_DIR / "validation" / f"l1-{theme_slug}.json"

    if not final_path.exists():
        raise FileNotFoundError(f"No pipeline output: {final_path}")

    theme_json = json.loads(final_path.read_text(encoding="utf-8"))
    theme_name = theme_json.get("theme_basic", {}).get("theme_tagline", theme_slug)

    l1_summary = "L1 not run yet"
    if l1_path.exists():
        l1 = json.loads(l1_path.read_text(encoding="utf-8"))
        s = l1["summary"]
        l1_summary = f"{s['errors']} errors, {s['warnings']} warnings, {s['info']} info"

    artifact = f"""# L2 Review -- {theme_name}

**Generated:** {datetime.utcnow().isoformat()}Z
**Final JSON:** data/cache/final/{theme_slug}.json
**L1 Validation:** data/cache/validation/l1-{theme_slug}.json
**L1 Summary:** {l1_summary}

## Review Mission

You (Claude) are reviewing the editorial accuracy of pipeline output for `{theme_slug}`.
This is L2 of the 3-layer validation system. Apply qualitative judgment that L1
(structural) and L3 (human final) cannot.

## Method

1. Read the final JSON file (path above)
2. Read the L1 validation issues (path above)
3. For each field listed in "Fields to assess" below:
   - Form a judgment based on:
     - L1 validation flags for that field
     - Internal consistency with other fields
     - Plausibility given known facts about WordPress themes
     - Source citations support the claim
   - Output a verdict (see format below)
4. Do NOT verify via web search -- that is outside L2 scope.
   Use only the JSON content and your trained knowledge.

## Fields to assess

For each field below, output verdict to `data/l2-verdicts/{theme_slug}.json`:

- `quick_overview.quick_verdict` (Safe to use / Caution / Avoid)
- `scenario_performance` (perf_verdict_safe / caution / avoid)
- `handoff_difficulty` (handoff_verdict_safe / caution / avoid)
- `scenario_updates` (updates_verdict_safe / caution / avoid)
- `community_pain_points` (sample top 5: severity/frequency plausibility, source quality)
- `plugin_compatibility_list` (status consistency with notes)
- `theme_pricing` (pricing_model classification correctness)
- `theme_technical.last_verification` (does this date make sense?)
- `sources_methodology.confidence_statement` (matches actual source count?)

## Verdict format

Output a single JSON object to `data/l2-verdicts/{theme_slug}.json`:

```json
{{
  "theme_slug": "{theme_slug}",
  "reviewed_at": "<ISO timestamp>",
  "verdicts": [
    {{
      "field_path": "quick_overview.quick_verdict",
      "current_value": "<value from JSON>",
      "verdict": "agree | disagree | uncertain",
      "confidence": 0.0-1.0,
      "reasoning": "Short rationale (1-3 sentences)",
      "suggested_value": null
    }}
  ],
  "summary": {{
    "fields_reviewed": 0,
    "agree": 0,
    "disagree": 0,
    "uncertain": 0,
    "high_confidence_count": 0,
    "overall_assessment": "Short paragraph: would I recommend publishing this profile as-is?"
  }}
}}
```

## Confidence guidance

- **0.95-1.00:** Near certainty. Factual claims with clear evidence.
- **0.80-0.95:** Strong confidence with minor uncertainty.
- **0.60-0.80:** Reasonable judgment but room for disagreement.
- **<0.60:** Uncertain. Default to `verdict: uncertain`.

**Auto-merge threshold:** confidence >= 0.95 with verdict=disagree.

## Out of scope for L2

- Web verification (Perplexity / web search)
- Modifying the JSON directly -- only write verdicts
- Assessing fields not in the list above
"""

    PENDING_DIR.mkdir(parents=True, exist_ok=True)
    artifact_path = PENDING_DIR / f"l2-{theme_slug}.md"
    artifact_path.write_text(artifact, encoding="utf-8")
    return str(artifact_path)
