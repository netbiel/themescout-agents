"""
ThemeScout Agent Scheduler — runs tasks on schedule.

Architecture decisions:
  - Uses `schedule` library (lightweight, no daemon needed)
  - Runs in foreground (Piotr starts manually or via Windows Task Scheduler)
  - Each task is isolated: failure in one doesn't block others
  - All outputs go to standard locations (data/cache/, data/baseline/, reports/)
  - State tracked in core/state.json
  - Logs to data/logs/scheduler-<date>.log
"""

import json
import logging
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path

import schedule

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def _setup_logger() -> logging.Logger:
    log_dir = REPO_ROOT / "data" / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    date = datetime.now().strftime("%Y-%m-%d")
    logger = logging.getLogger("scheduler")
    logger.setLevel(logging.INFO)
    if not logger.handlers:
        fh = logging.FileHandler(log_dir / f"scheduler-{date}.log", encoding="utf-8")
        fh.setFormatter(logging.Formatter("%(asctime)s | %(levelname)s | %(message)s"))
        logger.addHandler(fh)
        sh = logging.StreamHandler()
        sh.setFormatter(logging.Formatter("%(asctime)s | %(message)s"))
        logger.addHandler(sh)
    return logger


def _update_state(key: str, value):
    """Update a field in core/state.json."""
    state_path = REPO_ROOT / "core" / "state.json"
    state = json.loads(state_path.read_text(encoding="utf-8"))
    state[key] = value
    state["last_updated"] = datetime.now(timezone.utc).isoformat()
    state_path.write_text(json.dumps(state, indent=2), encoding="utf-8")


def _safe_run(task_name: str, func, logger: logging.Logger):
    """Run a task with error isolation."""
    logger.info(f"--- Starting: {task_name} ---")
    try:
        func()
        logger.info(f"--- Completed: {task_name} ---")
    except Exception as e:
        logger.error(f"--- FAILED: {task_name} --- {e}")
        logger.debug(traceback.format_exc())
        # Write alert to daily alerts
        _write_alert(task_name, str(e))


def _write_alert(task_name: str, error_msg: str):
    """Write alert to reports/daily/ for failed tasks."""
    alerts_dir = REPO_ROOT / "reports" / "daily"
    alerts_dir.mkdir(parents=True, exist_ok=True)
    date = datetime.now().strftime("%Y-%m-%d")
    alert_path = alerts_dir / f"{date}-alerts.md"

    timestamp = datetime.now(timezone.utc).strftime("%H:%M:%S")
    entry = f"- **{timestamp}** [{task_name}] FAILED: {error_msg}\n"

    with open(alert_path, "a", encoding="utf-8") as f:
        if alert_path.stat().st_size == 0:
            f.write(f"# Daily Alerts -- {date}\n\n")
        f.write(entry)


# ─── Task Functions ──────────────────────────────────────────────

def task_ga4_daily_pull():
    """Pull GA4 data and save to baseline."""
    from modules.stats_analyzer.ga4 import get_weekly_overview, get_traffic_sources, get_llm_referrals
    import json
    from datetime import date

    property_id = "518707870"
    end = date.today()

    overview = get_weekly_overview(property_id, end)
    sources = get_traffic_sources(property_id, 7)
    llm = get_llm_referrals(property_id, 7)

    baseline_dir = REPO_ROOT / "data" / "baseline"
    baseline_dir.mkdir(parents=True, exist_ok=True)

    ds = end.isoformat()
    (baseline_dir / f"ga4-weekly-{ds}.json").write_text(json.dumps(overview, indent=2), encoding="utf-8")
    (baseline_dir / f"ga4-sources-7d-{ds}.json").write_text(json.dumps(sources, indent=2), encoding="utf-8")
    (baseline_dir / f"ga4-llm-referrals-7d-{ds}.json").write_text(json.dumps(llm, indent=2), encoding="utf-8")

    _update_state("last_run", datetime.now(timezone.utc).isoformat())


def task_reddit_scan():
    """Scan Reddit for relevant threads."""
    from modules.research.reddit_rss import scan_subreddits, save_scan_results

    threads = scan_subreddits(max_age_hours=24)
    if threads:
        save_scan_results(threads)

        # Classify top threads with local LLM if available
        try:
            from modules.research.llm_classify import batch_classify
            top = [t.__dict__ if hasattr(t, '__dict__') else t for t in threads[:5]]
            batch_classify(top)
        except Exception:
            pass  # Local LLM optional


def task_daily_alert_check():
    """Check for anomalies and write daily alert if needed."""
    import json
    from datetime import date

    baseline_dir = REPO_ROOT / "data" / "baseline"
    today = date.today().isoformat()
    yesterday = date.fromordinal(date.today().toordinal() - 1).isoformat()

    today_file = baseline_dir / f"ga4-weekly-{today}.json"
    if not today_file.exists():
        return

    today_data = json.loads(today_file.read_text(encoding="utf-8"))
    tw = today_data.get("this_week", {})
    lw = today_data.get("last_week", {})

    alerts = []
    # Check for >10% drops (mandatory reporting per charter)
    for metric in ["sessions", "engagedSessions", "activeUsers"]:
        try:
            current = int(tw.get(metric, 0))
            previous = int(lw.get(metric, 0))
            if previous > 0 and current < previous * 0.9:
                drop_pct = round((1 - current / previous) * 100, 1)
                alerts.append(f"{metric} dropped {drop_pct}%: {previous} -> {current}")
        except (ValueError, TypeError):
            pass

    if alerts:
        alerts_dir = REPO_ROOT / "reports" / "daily"
        alerts_dir.mkdir(parents=True, exist_ok=True)
        alert_path = alerts_dir / f"{today}-alerts.md"
        with open(alert_path, "a", encoding="utf-8") as f:
            if not alert_path.exists() or alert_path.stat().st_size == 0:
                f.write(f"# Daily Alerts -- {today}\n\n")
            for a in alerts:
                f.write(f"- **METRIC DROP** {a}\n")


def task_cost_check():
    """Check weekly cost against guardrails."""
    llm_log = REPO_ROOT / "data" / "llm-calls.log"
    if not llm_log.exists():
        return

    from datetime import date, timedelta
    week_start = (date.today() - timedelta(days=date.today().weekday())).isoformat()
    week_cost = 0.0

    for line in llm_log.read_text(encoding="utf-8").strip().split("\n"):
        if not line.strip():
            continue
        parts = line.split(" | ")
        if len(parts) >= 6:
            ts = parts[0][:10]
            if ts >= week_start:
                cost_str = parts[5].strip().lstrip("$")
                try:
                    week_cost += float(cost_str)
                except ValueError:
                    pass

    _update_state("cost_week_to_date_usd", round(week_cost, 2))

    if week_cost >= 30:
        _write_alert("cost_check", f"RED ZONE: Weekly cost ${week_cost:.2f} >= $30. Pipeline runs paused.")
    elif week_cost >= 15:
        _write_alert("cost_check", f"ORANGE ZONE: Weekly cost ${week_cost:.2f}. Requires Piotr's GO to continue.")


# ─── Schedule Configuration ──────────────────────────────────────

def configure_schedule():
    """Set up the schedule. All times in local timezone."""
    # Daily at 7:00 — GA4 data pull
    schedule.every().day.at("07:00").do(
        lambda: _safe_run("ga4_daily_pull", task_ga4_daily_pull, _setup_logger()))

    # Daily at 7:30 — anomaly check
    schedule.every().day.at("07:30").do(
        lambda: _safe_run("daily_alert_check", task_daily_alert_check, _setup_logger()))

    # Every 6 hours — Reddit scan
    schedule.every(6).hours.do(
        lambda: _safe_run("reddit_scan", task_reddit_scan, _setup_logger()))

    # Daily at 23:00 — cost check
    schedule.every().day.at("23:00").do(
        lambda: _safe_run("cost_check", task_cost_check, _setup_logger()))


def run_scheduler():
    """Run the scheduler loop. Blocks until interrupted."""
    logger = _setup_logger()
    configure_schedule()
    logger.info("Scheduler started. Press Ctrl+C to stop.")
    logger.info(f"Jobs: {[str(j) for j in schedule.get_jobs()]}")

    while True:
        schedule.run_pending()
        time.sleep(60)


def run_all_now():
    """Run all scheduled tasks immediately (for testing)."""
    logger = _setup_logger()
    logger.info("Running all tasks immediately...")
    _safe_run("ga4_daily_pull", task_ga4_daily_pull, logger)
    _safe_run("reddit_scan", task_reddit_scan, logger)
    _safe_run("daily_alert_check", task_daily_alert_check, logger)
    _safe_run("cost_check", task_cost_check, logger)
    logger.info("All tasks complete.")
