"""
CLI for Theme Collector module.

Usage:
    python -m modules.theme_collector.cli step1 neve --inputs data/parity-benchmarks/neve/inputs.json
    python -m modules.theme_collector.cli test-gemini
"""

import json
import os
from pathlib import Path

import click
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

# Load secrets
secrets_path = REPO_ROOT / "config" / "secrets.env"
if secrets_path.exists():
    load_dotenv(secrets_path)

# Also check .secret dir for API keys
secret_dir = REPO_ROOT.parent / ".secret"


def _ensure_gemini_configured():
    """Configure Gemini API key from environment or .secret."""
    from modules.theme_collector.pipeline.gemini_client import configure

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        key_file = secret_dir / "gemini_api_key.txt"
        if key_file.exists():
            api_key = key_file.read_text().strip()
    if not api_key:
        raise click.ClickException(
            "GEMINI_API_KEY not set. Add to config/secrets.env or .secret/gemini_api_key.txt"
        )
    configure(api_key)


@click.group()
def cli():
    """ThemeScout Theme Collector — Pipeline CLI."""
    pass


@cli.command("test-gemini")
def test_gemini():
    """Test Gemini API connection."""
    _ensure_gemini_configured()
    from modules.theme_collector.pipeline.gemini_client import call_gemini

    click.echo("Testing Gemini API...")
    try:
        result = call_gemini(
            prompt="Reply with exactly: CONNECTION_OK",
            step_name="test",
            theme_slug="test",
            max_output_tokens=50,
        )
        if "CONNECTION_OK" in result:
            click.echo("Gemini API: OK")
        else:
            click.echo(f"Gemini API responded: {result[:100]}")
    except Exception as e:
        click.echo(f"Error: {e}", err=True)
        raise SystemExit(1)


@cli.command()
@click.argument("theme_slug")
@click.option("--inputs", type=click.Path(exists=True), required=True,
              help="Path to inputs.json with theme_name, scraped_json, perplexity_text")
def step1(theme_slug: str, inputs: str):
    """Run Step 1 (Community Analysis) for a single theme."""
    _ensure_gemini_configured()
    from modules.theme_collector.pipeline.step1_community import run_step1

    inputs_data = json.loads(Path(inputs).read_text(encoding="utf-8"))
    theme_name = inputs_data.get("theme_name", theme_slug)
    scraped_json = inputs_data.get("scraped_json", {})
    perplexity_text = inputs_data.get("perplexity_text", "")
    changelog = inputs_data.get("changelog", "")

    click.echo(f"Running Step 1 for {theme_name}...")
    output = run_step1(
        theme_name=theme_name,
        scraped_json=scraped_json,
        perplexity_text=perplexity_text,
        changelog=changelog,
        theme_slug=theme_slug,
    )
    click.echo(f"Step 1 complete. Output saved to data/cache/step1/{theme_slug}.md")
    click.echo(f"Output length: {len(output)} chars")


if __name__ == "__main__":
    cli()
