"""
GA4 Data API queries for ThemeScout Stats Analyzer.
"""

from datetime import date, timedelta

from google.analytics.data_v1beta.types import (
    DateRange,
    Dimension,
    Metric,
    RunReportRequest,
)

from .auth import get_ga4_client


def run_report(property_id: str, start_date: date, end_date: date,
               dimensions: list[str], metrics: list[str]) -> list[dict]:
    """Run a GA4 report and return rows as list of dicts."""
    client = get_ga4_client()

    request = RunReportRequest(
        property=f"properties/{property_id}",
        date_ranges=[DateRange(
            start_date=start_date.isoformat(),
            end_date=end_date.isoformat(),
        )],
        dimensions=[Dimension(name=d) for d in dimensions],
        metrics=[Metric(name=m) for m in metrics],
    )

    response = client.run_report(request)

    rows = []
    for row in response.rows:
        entry = {}
        for i, dim in enumerate(dimensions):
            entry[dim] = row.dimension_values[i].value
        for i, met in enumerate(metrics):
            entry[met] = row.metric_values[i].value
        rows.append(entry)

    return rows


def get_weekly_overview(property_id: str, end_date: date = None) -> dict:
    """Get key metrics for the last 7 days vs previous 7 days."""
    if end_date is None:
        end_date = date.today() - timedelta(days=1)  # yesterday
    start_date = end_date - timedelta(days=6)

    prev_end = start_date - timedelta(days=1)
    prev_start = prev_end - timedelta(days=6)

    metrics_list = [
        "sessions",
        "engagedSessions",
        "activeUsers",
        "screenPageViews",
        "averageSessionDuration",
    ]

    this_week = run_report(property_id, start_date, end_date, [], metrics_list)
    last_week = run_report(property_id, prev_start, prev_end, [], metrics_list)

    return {
        "period": {
            "this_week": {"start": start_date.isoformat(), "end": end_date.isoformat()},
            "last_week": {"start": prev_start.isoformat(), "end": prev_end.isoformat()},
        },
        "this_week": this_week[0] if this_week else {},
        "last_week": last_week[0] if last_week else {},
    }


def get_traffic_sources(property_id: str, days: int = 7) -> list[dict]:
    """Get traffic by source/medium for the last N days."""
    end_date = date.today() - timedelta(days=1)
    start_date = end_date - timedelta(days=days - 1)

    return run_report(
        property_id, start_date, end_date,
        dimensions=["sessionSource", "sessionMedium"],
        metrics=["sessions", "engagedSessions", "activeUsers"],
    )


def get_llm_referrals(property_id: str, days: int = 7) -> list[dict]:
    """Get sessions from LLM sources (ChatGPT, Perplexity, Claude, etc.)."""
    sources = get_traffic_sources(property_id, days)
    llm_domains = ["chatgpt.com", "perplexity.ai", "claude.ai", "copilot.microsoft.com",
                    "gemini.google.com", "you.com", "phind.com"]
    return [s for s in sources if any(d in s.get("sessionSource", "") for d in llm_domains)]
