"""
Step 3: JSON Formatter
Port of Apps Script buildStep3Prompt() from v3.20.3.

Input: Step 1 + Step 2 outputs + scraped JSON
Output: Raw JSON (~80 fields) for WordPress import
Model: Gemini Pro 2.5 (JSON mode)
"""

import json
from pathlib import Path
from string import Template

from .gemini_client import call_gemini
from .step1_community import get_distribution_model, get_distribution_instructions

PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "step3_json.txt"
SCHEMA_PATH = Path(__file__).resolve().parent.parent / "prompts" / "json_schema.txt"
CACHE_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "cache" / "step3-raw"


def run_step3(
    theme_name: str,
    scraped_json: dict | str,
    step1_output: str,
    step2_output: str,
    theme_slug: str | None = None,
) -> dict:
    """Run Step 3 JSON Formatter. Returns parsed JSON dict."""
    if isinstance(scraped_json, str):
        scraped_json_str = scraped_json if scraped_json.strip() else "{}"
    else:
        scraped_json_str = json.dumps(scraped_json, indent=2) if scraped_json else "{}"

    if theme_slug is None:
        theme_slug = theme_name.lower().replace(" ", "-")

    parsed = json.loads(scraped_json_str) if isinstance(scraped_json, str) and scraped_json.strip() else (scraped_json or {})
    distribution_model = get_distribution_model(parsed)
    distribution_instructions = get_distribution_instructions(distribution_model)
    json_schema = SCHEMA_PATH.read_text(encoding="utf-8")

    template_text = PROMPT_PATH.read_text(encoding="utf-8")
    template = Template(template_text)
    prompt = template.safe_substitute(
        theme_name=theme_name,
        distribution_instructions=distribution_instructions,
        distribution_model=distribution_model,
        scraped_json=scraped_json_str,
        step1_output=step1_output,
        step2_output=step2_output,
        json_schema=json_schema,
    )

    output_text = call_gemini(
        prompt=prompt,
        step_name="step3",
        theme_slug=theme_slug,
        json_mode=True,
    )

    # Parse JSON — strip markdown fences if present
    text = output_text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

    data = json.loads(text)

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    (CACHE_DIR / f"{theme_slug}.json").write_text(
        json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    return data
