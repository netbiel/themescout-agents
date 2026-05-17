"""
Orchestrator CLI — scheduler management.

Usage:
    python -m modules.orchestrator.cli start       # start scheduler loop
    python -m modules.orchestrator.cli run-now      # run all tasks immediately
    python -m modules.orchestrator.cli status       # show schedule + last runs
"""

import json
from pathlib import Path

import click

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


@click.group()
def cli():
    """ThemeScout Agent Orchestrator."""
    pass


@cli.command()
def start():
    """Start the scheduler (blocks, runs tasks on schedule)."""
    from .scheduler import run_scheduler
    click.echo("Starting scheduler...")
    click.echo("Schedule: GA4 daily 07:00, alerts 07:30, Reddit every 6h, cost check 23:00")
    click.echo("Press Ctrl+C to stop.")
    try:
        run_scheduler()
    except KeyboardInterrupt:
        click.echo("\nScheduler stopped.")


@cli.command("run-now")
def run_now():
    """Run all scheduled tasks immediately."""
    from .scheduler import run_all_now
    click.echo("Running all tasks now...")
    run_all_now()
    click.echo("Done.")


@cli.command()
def status():
    """Show current state and schedule info."""
    state_path = REPO_ROOT / "core" / "state.json"
    state = json.loads(state_path.read_text(encoding="utf-8"))

    click.echo("ThemeScout Agent Status:")
    click.echo(f"  Sprint: {state.get('current_sprint', '?')}")
    click.echo(f"  Last updated: {state.get('last_updated', 'never')}")
    click.echo(f"  Last run: {state.get('last_run', 'never')}")
    click.echo(f"  Cost (week): ${state.get('cost_week_to_date_usd', 0):.2f}")
    click.echo(f"  Cost (month): ${state.get('cost_month_to_date_usd', 0):.2f}")
    click.echo(f"  Pending review: {state.get('pending_review_count', 0)}")
    click.echo(f"  Warnings: {state.get('active_warnings', [])}")

    click.echo("\nOpen loops:")
    for loop in state.get("open_loops", []):
        blocker = " [BLOCKER]" if loop.get("blocker") else ""
        click.echo(f"  - {loop['description']}{blocker}")

    # Check today's alerts
    from datetime import date
    alerts_path = REPO_ROOT / "reports" / "daily" / f"{date.today().isoformat()}-alerts.md"
    if alerts_path.exists():
        click.echo(f"\nToday's alerts:")
        click.echo(alerts_path.read_text(encoding="utf-8"))
    else:
        click.echo("\nNo alerts today.")


if __name__ == "__main__":
    cli()
