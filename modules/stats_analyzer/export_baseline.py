"""
Export GA4 baseline data to data/baseline/ for Sprint 1.

Usage:
    python -m modules.stats_analyzer.export_baseline --property-id 518707870
"""

import json
from datetime import date, timedelta
from pathlib import Path

import click

from .ga4 import get_weekly_overview, get_traffic_sources, get_llm_referrals, run_report

BASELINE_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "baseline"


def export_weekly_metrics(property_id: str, end_date: date) -> dict:
    """Export weekly overview + sources + LLM referrals."""
    overview = get_weekly_overview(property_id, end_date)
    sources_7d = get_traffic_sources(property_id, 7)
    sources_28d = get_traffic_sources(property_id, 28)
    llm_7d = get_llm_referrals(property_id, 7)
    llm_28d = get_llm_referrals(property_id, 28)

    # Top pages last 28 days
    start_28d = end_date - timedelta(days=27)
    top_pages = run_report(
        property_id, start_28d, end_date,
        dimensions=["pagePath", "pageTitle"],
        metrics=["screenPageViews", "engagedSessions", "activeUsers"],
    )

    return {
        "exported_at": date.today().isoformat(),
        "property_id": property_id,
        "weekly_overview": overview,
        "sources_7d": sources_7d,
        "sources_28d": sources_28d,
        "llm_referrals_7d": llm_7d,
        "llm_referrals_28d": llm_28d,
        "top_pages_28d": top_pages,
    }


@click.command()
@click.option("--property-id", required=True, help="GA4 Property ID")
def main(property_id):
    """Export GA4 baseline data."""
    end_date = date.today() - timedelta(days=1)

    click.echo(f"Exporting GA4 baseline for property {property_id}...")
    data = export_weekly_metrics(property_id, end_date)

    BASELINE_DIR.mkdir(parents=True, exist_ok=True)

    # Weekly snapshot
    weekly_file = BASELINE_DIR / f"ga4-weekly-{end_date.isoformat()}.json"
    weekly_file.write_text(json.dumps(data["weekly_overview"], indent=2))
    click.echo(f"  -> {weekly_file}")

    # Sources
    sources_file = BASELINE_DIR / f"ga4-sources-28d-{end_date.isoformat()}.json"
    sources_file.write_text(json.dumps(data["sources_28d"], indent=2))
    click.echo(f"  -> {sources_file}")

    # LLM referrals
    llm_file = BASELINE_DIR / f"ga4-llm-referrals-28d-{end_date.isoformat()}.json"
    llm_file.write_text(json.dumps(data["llm_referrals_28d"], indent=2))
    click.echo(f"  -> {llm_file}")

    # Top pages
    pages_file = BASELINE_DIR / f"ga4-top-pages-28d-{end_date.isoformat()}.json"
    pages_file.write_text(json.dumps(data["top_pages_28d"], indent=2))
    click.echo(f"  -> {pages_file}")

    # Full baseline snapshot
    full_file = BASELINE_DIR / f"ga4-baseline-{end_date.isoformat()}.json"
    full_file.write_text(json.dumps(data, indent=2))
    click.echo(f"  -> {full_file} (full snapshot)")

    click.echo("Done.")


if __name__ == "__main__":
    main()
