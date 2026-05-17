"""
Pipeline orchestrator — runs all steps in sequence.
Port of Apps Script "Run All Steps → Assign Taxonomies → Re-run Cleanup" workflow.
"""

import json
from pathlib import Path

from .step1_community import run_step1
from .step2_verdict import run_step2
from .step3_json import run_step3
from .cleanup import cleanup_output
from .taxonomies import assign_taxonomies
from .search_profile import generate_search_profile
from ..validation.l1_structural import run_and_save as run_l1_validation

CACHE_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "cache"


def run_pipeline(
    theme_name: str,
    scraped_json: dict | str,
    perplexity_text: str,
    changelog: str = "",
    theme_slug: str | None = None,
) -> dict:
    """
    Run full pipeline end-to-end.

    Workflow (mirrors Apps Script):
      1. Run Step 1 → cache
      2. Run Step 2 → cache
      3. Run Step 3 → raw JSON
      4. cleanup_output(raw_json) → cleaned JSON
      5. assign_taxonomies(cleaned_json) → taxonomy_terms
      6. fix_handoff_score already in cleanup
      7. generate_search_profile() → inject into JSON
      8. Save to data/cache/final/<theme-slug>.json

    Returns final JSON dict.
    """
    if theme_slug is None:
        theme_slug = theme_name.lower().replace(" ", "-")

    if isinstance(scraped_json, str):
        scraped_json_parsed = json.loads(scraped_json) if scraped_json.strip() else {}
    else:
        scraped_json_parsed = scraped_json or {}

    # Step 1: Community Analysis
    step1_output = run_step1(
        theme_name=theme_name,
        scraped_json=scraped_json_parsed,
        perplexity_text=perplexity_text,
        changelog=changelog,
        theme_slug=theme_slug,
    )

    # Step 2: Verdict Synthesis
    step2_output = run_step2(
        theme_name=theme_name,
        scraped_json=scraped_json_parsed,
        step1_output=step1_output,
        theme_slug=theme_slug,
    )

    # Step 3: JSON Formatter
    raw_json = run_step3(
        theme_name=theme_name,
        scraped_json=scraped_json_parsed,
        step1_output=step1_output,
        step2_output=step2_output,
        theme_slug=theme_slug,
    )

    # Cleanup (pure Python)
    cleaned = cleanup_output(raw_json, theme_name)

    # Assign taxonomies (pure Python)
    taxonomy = assign_taxonomies(cleaned, theme_name)

    # Generate search profile (pure Python)
    profile = generate_search_profile(cleaned, theme_name, taxonomy)
    cleaned["search_profile"] = profile

    # L1 Validation (automatic after cleanup)
    l1_result = run_l1_validation(cleaned, theme_slug, taxonomy)

    # Save final output
    final_dir = CACHE_DIR / "final"
    final_dir.mkdir(parents=True, exist_ok=True)
    final_path = final_dir / f"{theme_slug}.json"
    final_path.write_text(json.dumps(cleaned, indent=2, ensure_ascii=False), encoding="utf-8")

    # Save taxonomy separately
    tax_path = final_dir / f"{theme_slug}-taxonomy.json"
    tax_path.write_text(json.dumps(taxonomy, indent=2), encoding="utf-8")

    return {
        "theme_json": cleaned,
        "taxonomy": taxonomy,
        "search_profile": profile,
        "output_path": str(final_path),
        "l1_validation": l1_result["summary"],
    }
