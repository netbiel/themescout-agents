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
            max_output_tokens=1000,
        )
        if result and "CONNECTION_OK" in result:
            click.echo("Gemini API: OK")
        else:
            click.echo(f"Gemini API responded: {(result or '(empty)')[:100]}")
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


@cli.command()
@click.argument("theme_slug")
@click.option("--inputs", type=click.Path(exists=True), required=True)
def run(theme_slug: str, inputs: str):
    """Run full pipeline (Step 1 ->Step 2 ->Step 3 ->Cleanup ->Taxonomies ->Search Profile)."""
    _ensure_gemini_configured()
    from modules.theme_collector.pipeline.orchestrator import run_pipeline

    inputs_data = json.loads(Path(inputs).read_text(encoding="utf-8"))
    theme_name = inputs_data.get("theme_name", theme_slug)

    click.echo(f"Running full pipeline for {theme_name}...")
    result = run_pipeline(
        theme_name=theme_name,
        scraped_json=inputs_data.get("scraped_json", {}),
        perplexity_text=inputs_data.get("perplexity_text", ""),
        changelog=inputs_data.get("changelog", ""),
        theme_slug=theme_slug,
    )
    click.echo(f"Pipeline complete!")
    click.echo(f"Output: {result['output_path']}")
    click.echo(f"Search profile: {result['search_profile'][:120]}...")
    click.echo(f"Taxonomy keys: {list(result['taxonomy'].keys())}")


@cli.command("parity-test")
@click.option("--themes", default=None, help="Comma-separated theme slugs (default: all)")
def parity_test(themes: str | None):
    """Run Step 1 parity check on benchmark themes."""
    from modules.theme_collector.validation.parity import run_parity_check

    theme_list = themes.split(",") if themes else None
    results = run_parity_check(theme_list)

    for slug, data in sorted(results.items()):
        if "error" in data:
            click.echo(f"  {slug}: ERROR — {data['error']}")
            continue
        click.echo(
            f"  {slug}: pain={data['pain_points_python']}/{data['pain_points_reference']} "
            f"praise={data['praise_python']}/{data['praise_reference']} "
            f"urls={data['source_url_overlap']:.0%} "
            f"len={data['length_ratio']}x"
        )


@cli.command("wp-test")
def wp_test():
    """Test WordPress API connection."""
    from modules.theme_collector.wp.client import WordPressClient
    wp = WordPressClient()
    info = wp.test_connection()
    click.echo(f"WordPress: {info['name']} ({info['url']}) — {info['status']}")


@cli.command("resolve-id")
@click.argument("theme_name")
def resolve_id(theme_name: str):
    """Resolve WP post ID for a theme name."""
    from modules.theme_collector.wp.client import WordPressClient
    from modules.theme_collector.wp.post_id_resolver import resolve_post_id
    wp = WordPressClient()
    pid = resolve_post_id(theme_name, wp)
    click.echo(f"{theme_name} ->post_id={pid}")


@cli.command("import")
@click.argument("theme_slug")
@click.option("--no-dry-run", is_flag=True, default=False, help="Actually import (default: dry run)")
@click.option("--skip-validation", is_flag=True, default=False, help="Skip L1 validation gate")
def import_cmd(theme_slug: str, no_dry_run: bool, skip_validation: bool):
    """Import theme JSON to WordPress (dry run by default)."""
    from modules.theme_collector.wp.client import WordPressClient
    from modules.theme_collector.wp.post_id_resolver import resolve_post_id
    from modules.theme_collector.wp.importer import import_theme_to_wp

    final_path = Path(REPO_ROOT) / "data" / "cache" / "final" / f"{theme_slug}.json"
    if not final_path.exists():
        raise click.ClickException(f"No pipeline output found at {final_path}. Run pipeline first.")

    theme_json = json.loads(final_path.read_text(encoding="utf-8"))
    theme_name = theme_json.get("theme_basic", {}).get("theme_tagline", theme_slug)

    wp = WordPressClient()
    post_id = resolve_post_id(theme_slug.replace("-", " ").title(), wp)
    if not post_id:
        raise click.ClickException(f"Could not resolve WP post ID for '{theme_slug}'")

    dry_run = not no_dry_run
    mode = "DRY RUN" if dry_run else "LIVE IMPORT"
    click.echo(f"[{mode}] Importing {theme_slug} ->post_id={post_id}...")

    try:
        result = import_theme_to_wp(theme_slug, theme_json, wp, post_id, dry_run=dry_run, skip_validation=skip_validation)
    except Exception as e:
        if "L1 validation" in str(e):
            click.echo(f"BLOCKED: {e}", err=True)
            click.echo("Use --skip-validation to override.", err=True)
            raise SystemExit(1)
        raise
    if result.success:
        click.echo(f"{'Would write' if dry_run else 'Wrote'} {result.fields_written} fields")
        if result.skipped_fields:
            click.echo(f"Skipped (manual overrides): {result.skipped_fields}")
    else:
        click.echo(f"FAILED: {result.errors}", err=True)
        raise SystemExit(1)


@cli.command("full-run")
@click.argument("theme_slug")
@click.option("--inputs", type=click.Path(exists=True), required=True)
@click.option("--import-wp", is_flag=True, default=False, help="Also import to WP after pipeline")
@click.option("--no-dry-run", is_flag=True, default=False, help="Actually import (requires --import-wp)")
def full_run(theme_slug: str, inputs: str, import_wp: bool, no_dry_run: bool):
    """Run pipeline + optional WP import."""
    _ensure_gemini_configured()
    from modules.theme_collector.pipeline.orchestrator import run_pipeline

    inputs_data = json.loads(Path(inputs).read_text(encoding="utf-8"))
    theme_name = inputs_data.get("theme_name", theme_slug)

    click.echo(f"Running full pipeline for {theme_name}...")
    result = run_pipeline(
        theme_name=theme_name,
        scraped_json=inputs_data.get("scraped_json", {}),
        perplexity_text=inputs_data.get("perplexity_text", ""),
        changelog=inputs_data.get("changelog", ""),
        theme_slug=theme_slug,
    )
    click.echo(f"Pipeline done: {result['output_path']}")

    if import_wp:
        from modules.theme_collector.wp.client import WordPressClient
        from modules.theme_collector.wp.post_id_resolver import resolve_post_id
        from modules.theme_collector.wp.importer import import_theme_to_wp

        wp = WordPressClient()
        post_id = resolve_post_id(theme_name, wp)
        if not post_id:
            click.echo(f"WARNING: Could not resolve post_id for {theme_name}", err=True)
            return
        dry_run = not no_dry_run
        mode = "DRY RUN" if dry_run else "LIVE"
        click.echo(f"[{mode}] Importing ->post_id={post_id}...")
        imp = import_theme_to_wp(theme_slug, result["theme_json"], wp, post_id, dry_run=dry_run)
        click.echo(f"Import: success={imp.success}, fields={imp.fields_written}")


@cli.command("review")
@click.argument("theme_slug")
def review(theme_slug: str):
    """Generate L2 review artifact for Claude Code session."""
    from modules.theme_collector.validation.l2_review import generate_review_artifact
    path = generate_review_artifact(theme_slug)
    click.echo(f"L2 review artifact ready: {path}")
    click.echo(f"Open Claude Code and ask: 'Review the L2 artifact for {theme_slug}'")


@cli.command("apply-l2")
@click.argument("theme_slug")
@click.option("--no-dry-run", is_flag=True, default=False, help="Apply auto-merges")
def apply_l2(theme_slug: str, no_dry_run: bool):
    """Apply L2 verdicts (auto-merge high-confidence, flag rest for L3)."""
    from modules.theme_collector.validation.l2_apply import apply_l2_verdicts
    result = apply_l2_verdicts(theme_slug, dry_run=not no_dry_run)

    if result.aborted:
        click.echo(f"ABORTED: {result.abort_reason}", err=True)
        return

    mode = "DRY RUN" if result.dry_run else "APPLIED"
    click.echo(f"[{mode}] L2 results for {theme_slug}:")
    click.echo(f"  Agreed: {result.agreed}")
    click.echo(f"  Auto-merge candidates: {len(result.auto_merged)}")
    for m in result.auto_merged:
        click.echo(f"    {m['field_path']}: {m['old_value']} -> {m['new_value']} (conf={m['confidence']})")
    click.echo(f"  Flagged for L3: {len(result.flagged_for_l3)}")
    for f in result.flagged_for_l3:
        click.echo(f"    {f['field_path']}: {f['verdict']} (conf={f['confidence']})")

    if not no_dry_run and result.auto_merged:
        click.echo("Run with --no-dry-run to apply auto-merges.")


@cli.command("validate")
@click.argument("theme_slug")
def validate(theme_slug: str):
    """Run L1 validation on a theme's final JSON."""
    from modules.theme_collector.validation.l1_structural import run_and_save
    import json

    final_path = Path(REPO_ROOT) / "data" / "cache" / "final" / f"{theme_slug}.json"
    if not final_path.exists():
        raise click.ClickException(f"No final JSON for {theme_slug}")

    theme_json = json.loads(final_path.read_text(encoding="utf-8"))
    result = run_and_save(theme_json, theme_slug)

    s = result["summary"]
    click.echo(f"L1 Validation: {s['errors']} errors, {s['warnings']} warnings, {s['info']} info")
    if s["blocks_import"]:
        click.echo("STATUS: BLOCKS IMPORT (has errors)")
    else:
        click.echo("STATUS: OK (can import)")

    for issue in result["issues"]:
        icon = {"error": "E", "warning": "W", "info": "I"}[issue["severity"]]
        click.echo(f"  [{icon}] {issue['field_path']}: {issue['expected_or_issue']}")


if __name__ == "__main__":
    cli()
