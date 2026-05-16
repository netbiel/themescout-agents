"""
CLI for Stats Analyzer module. Quick access to GA4 + Clarity data.

Usage:
    python -m modules.stats_analyzer.cli verify --property-id 123456789
    python -m modules.stats_analyzer.cli weekly --property-id 123456789
    python -m modules.stats_analyzer.cli sources --property-id 123456789
    python -m modules.stats_analyzer.cli clarity-test
"""

import json

import click

from .ga4 import get_weekly_overview, get_traffic_sources, get_llm_referrals
from .clarity import get_overview as clarity_overview, get_by_url, get_by_source as clarity_sources


@click.group()
def cli():
    """ThemeScout Stats Analyzer — GA4 data access."""
    pass


@cli.command()
@click.option("--property-id", required=True, help="GA4 Property ID")
def verify(property_id):
    """Verify GA4 API access by fetching last 7 days sessions."""
    click.echo(f"Verifying access to GA4 property {property_id}...")
    try:
        data = get_weekly_overview(property_id)
        click.echo("Access OK!")
        click.echo(f"Period: {data['period']['this_week']['start']} to {data['period']['this_week']['end']}")
        if data["this_week"]:
            click.echo(f"Sessions (this week): {data['this_week'].get('sessions', 'n/a')}")
            click.echo(f"Engaged sessions: {data['this_week'].get('engagedSessions', 'n/a')}")
            click.echo(f"Active users: {data['this_week'].get('activeUsers', 'n/a')}")
        else:
            click.echo("No data returned for this period.")
    except Exception as e:
        click.echo(f"Error: {e}", err=True)
        raise SystemExit(1)


@cli.command()
@click.option("--property-id", required=True, help="GA4 Property ID")
def weekly(property_id):
    """Get weekly overview (this week vs last week)."""
    data = get_weekly_overview(property_id)
    click.echo(json.dumps(data, indent=2))


@cli.command()
@click.option("--property-id", required=True, help="GA4 Property ID")
@click.option("--days", default=7, help="Number of days to look back")
def sources(property_id, days):
    """Get traffic sources breakdown."""
    data = get_traffic_sources(property_id, days)
    click.echo(json.dumps(data, indent=2))


@cli.command()
@click.option("--property-id", required=True, help="GA4 Property ID")
@click.option("--days", default=7, help="Number of days to look back")
def llm(property_id, days):
    """Get LLM referral traffic (ChatGPT, Perplexity, Claude, etc.)."""
    data = get_llm_referrals(property_id, days)
    if data:
        click.echo(json.dumps(data, indent=2))
    else:
        click.echo("No LLM referral traffic found in this period.")


@cli.command("clarity-test")
@click.option("--days", default=3, type=click.IntRange(1, 3), help="Days of data (1-3)")
def clarity_test(days):
    """Test Clarity API access."""
    click.echo(f"Testing Clarity API ({days} day(s))...")
    data = clarity_overview(days)
    if data.get("error") == "no_data":
        click.echo(f"Clarity API responded but has no data: {data['message']}")
    else:
        click.echo("Clarity API OK!")
        click.echo(json.dumps(data, indent=2)[:2000])


@cli.command("clarity-urls")
@click.option("--days", default=3, type=click.IntRange(1, 3), help="Days of data (1-3)")
def clarity_urls(days):
    """Get Clarity metrics by URL."""
    data = get_by_url(days)
    click.echo(json.dumps(data, indent=2)[:2000])


@cli.command("clarity-sources")
@click.option("--days", default=3, type=click.IntRange(1, 3), help="Days of data (1-3)")
def clarity_sources_cmd(days):
    """Get Clarity metrics by traffic source."""
    data = clarity_sources(days)
    click.echo(json.dumps(data, indent=2)[:2000])


if __name__ == "__main__":
    cli()
