"""
CLI for Research module.

Usage:
    python -m modules.research.cli scan
    python -m modules.research.cli scan --hours 48
"""

import click

from .reddit_rss import scan_subreddits, save_scan_results


@click.group()
def cli():
    """ThemeScout Research — Reddit monitoring."""
    pass


@cli.command()
@click.option("--hours", default=72, help="Max age of threads in hours")
def scan(hours: int):
    """Scan configured subreddits for relevant threads."""
    click.echo(f"Scanning Reddit (last {hours}h)...")
    threads = scan_subreddits(max_age_hours=hours)

    if not threads:
        click.echo("No relevant threads found.")
        return

    path = save_scan_results(threads)
    click.echo(f"Found {len(threads)} relevant threads. Saved to {path}")
    click.echo("")

    for t in threads[:10]:
        click.echo(f"  [{t.relevance_score:.0%}] r/{t.subreddit} | {t.title[:70]}")
        click.echo(f"       {t.url}")
        click.echo(f"       score={t.score} comments={t.num_comments} keywords={t.matched_keywords}")
        click.echo("")


if __name__ == "__main__":
    cli()
