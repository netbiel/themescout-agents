"""
Step 1: Community Analysis
Port of Apps Script step1CommunityAnalysis() / buildStep1Prompt() from v3.20.3.

Reads:
  - theme name
  - scraped JSON (marketplace_data, pagespeed_data, distribution_model)
  - Perplexity research text
  - changelog text (optional)

Produces:
  - Markdown tables: pain points, praise, sources index

Model: Gemini Pro 2.5 (per docs/llm-routing.md)
Output destination: data/cache/step1/<theme-slug>.md
"""

import json
from pathlib import Path
from string import Template

from .gemini_client import call_gemini

PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "step1_community.txt"
CACHE_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "cache" / "step1"


def get_distribution_model(scraped_json: dict) -> str:
    """Detect distribution model from scraped data. Port of getDistributionModel()."""
    if not scraped_json:
        return "themeforest"
    m = (scraped_json.get("distribution_model") or
         (scraped_json.get("_meta", {}).get("distribution_model", ""))).lower().strip()
    if m in ("wordpress_org", "direct_sale", "themeforest"):
        return m
    src = (scraped_json.get("marketplace_data", {}).get("source", "")).lower()
    if "wordpress.org" in src:
        return "wordpress_org"
    if "themeforest" in src or "envato" in src:
        return "themeforest"
    src_url = (scraped_json.get("marketplace_data", {}).get("source_url", "")).lower()
    if "wordpress.org" in src_url:
        return "wordpress_org"
    if "themeforest.net" in src_url:
        return "themeforest"
    known = ["themeforest.net", "wordpress.org", "envato.com", "codecanyon.net", "creativemarket.com"]
    is_marketplace = any(k in src_url for k in known)
    if src_url and "http" in src_url and not is_marketplace:
        return "direct_sale"
    return "themeforest"


def get_distribution_instructions(model: str) -> str:
    """Generate distribution model instructions for prompt. Port of getDistributionModelInstructions()."""
    m = (model or "themeforest").lower().strip()
    if m == "wordpress_org":
        return (
            "## DISTRIBUTION MODEL: WordPress.org (Freemium)\n"
            "This theme is distributed via WordPress.org repository (free version) + author website (Pro).\n"
            "MANDATORY RULES:\n"
            "- Primary data source: wordpress.org/themes/ (active installs, rating, reviews)\n"
            "- Pro pricing/features: from author official website ONLY\n"
            "- DO NOT reference ThemeForest — this theme is NOT sold there\n"
            "- DO NOT attribute any data to ThemeForest or Envato marketplace\n"
            '- "sales_count" field = WordPress.org active installs (label as such)\n'
            '- external_ratings source = "WordPress.org" (not ThemeForest)\n'
            "- If you find ThemeForest URLs in scraped data, IGNORE them — they are errors\n\n"
        )
    if m == "direct_sale":
        return (
            "## DISTRIBUTION MODEL: Direct Sale\n"
            "This theme is sold exclusively through the author's website.\n"
            "MANDATORY RULES:\n"
            "- Primary data source: author official website\n"
            "- DO NOT reference ThemeForest — this theme is NOT sold there\n"
            "- DO NOT reference WordPress.org repository (unless free version exists)\n"
            "- DO NOT attribute any data to ThemeForest or Envato marketplace\n"
            '- "sales_count" = use author-reported numbers or "N/A"\n'
            "- external_ratings: use Trustpilot, G2, or similar — NOT ThemeForest\n\n"
        )
    return (
        "## DISTRIBUTION MODEL: ThemeForest\n"
        "This theme is sold on ThemeForest (Envato Market).\n"
        "RULES:\n"
        "- Primary marketplace source: ThemeForest\n"
        '- "sales_count" = ThemeForest total sales\n'
        "- external_ratings: ThemeForest rating is primary\n\n"
    )


def run_step1(
    theme_name: str,
    scraped_json: dict | str,
    perplexity_text: str,
    changelog: str = "",
    theme_slug: str | None = None,
) -> str:
    """Run Step 1 Community Analysis pipeline step."""
    if isinstance(scraped_json, str):
        scraped_json = json.loads(scraped_json) if scraped_json.strip() else {}

    if theme_slug is None:
        theme_slug = theme_name.lower().replace(" ", "-")

    distribution_model = get_distribution_model(scraped_json)
    distribution_instructions = get_distribution_instructions(distribution_model)

    # Load and fill prompt template
    template_text = PROMPT_PATH.read_text(encoding="utf-8")
    template = Template(template_text)
    prompt = template.safe_substitute(
        theme_name=theme_name,
        distribution_instructions=distribution_instructions,
        scraped_json=json.dumps(scraped_json, indent=2) if scraped_json else "No scraped data available.",
        perplexity_text=perplexity_text or "No Perplexity research available.",
        changelog=changelog or "No changelog data available.",
    )

    # Call Gemini
    output = call_gemini(
        prompt=prompt,
        step_name="step1",
        theme_slug=theme_slug,
    )

    # Save to cache
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    output_path = CACHE_DIR / f"{theme_slug}.md"
    output_path.write_text(output, encoding="utf-8")

    return output
