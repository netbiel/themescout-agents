"""
Step 2: Verdict Synthesis
Port of Apps Script buildStep2Prompt() from v3.20.3.

Input: Step 1 output (Markdown) + scraped JSON
Output: Markdown sections (verdicts, handoff, perf, plugin compat)
Model: Gemini Pro 2.5
"""

import json
from pathlib import Path
from string import Template

from .gemini_client import call_gemini
from .step1_community import get_distribution_model, get_distribution_instructions

PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "step2_verdict.txt"
CACHE_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "cache" / "step2"


def run_step2(
    theme_name: str,
    scraped_json: dict | str,
    step1_output: str,
    theme_slug: str | None = None,
) -> str:
    """Run Step 2 Verdict Synthesis."""
    if isinstance(scraped_json, str):
        scraped_json_str = scraped_json if scraped_json.strip() else "{}"
    else:
        scraped_json_str = json.dumps(scraped_json, indent=2) if scraped_json else "{}"

    if theme_slug is None:
        theme_slug = theme_name.lower().replace(" ", "-")

    parsed = json.loads(scraped_json_str) if isinstance(scraped_json, str) and scraped_json.strip() else (scraped_json or {})
    distribution_model = get_distribution_model(parsed)
    distribution_instructions = get_distribution_instructions(distribution_model)

    template_text = PROMPT_PATH.read_text(encoding="utf-8")
    template = Template(template_text)
    prompt = template.safe_substitute(
        theme_name=theme_name,
        distribution_instructions=distribution_instructions,
        distribution_model=distribution_model,
        scraped_json=scraped_json_str,
        step1_output=step1_output,
    )

    output = call_gemini(
        prompt=prompt,
        step_name="step2",
        theme_slug=theme_slug,
    )

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    (CACHE_DIR / f"{theme_slug}.md").write_text(output, encoding="utf-8")
    return output
