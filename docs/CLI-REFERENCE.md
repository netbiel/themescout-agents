# CLI Reference

All commands run from repo root with venv activated.

---

## Pre-Pipeline (Candidate Validation + PSI)

```bash
# Validate candidate URLs (marketplace, vendor, demo) + PSI reachability test
python -m modules.theme_collector.cli validate-candidates --input data/candidates/input/<batch>.json
python -m modules.theme_collector.cli validate-candidates --input <path> --resume  # resume interrupted

# Fetch full PSI measurements (3 mobile + 3 desktop runs per theme, ~30s each)
python -m modules.theme_collector.cli fetch-psi --input data/candidates/validated/<batch>.json
python -m modules.theme_collector.cli fetch-psi --input <path> --output-dir data/candidates/base-json/ --resume
```

Requires: PageSpeed Insights API enabled in Google Cloud Console for API key.

---

## Theme Collector Pipeline

```bash
# Test Gemini API connection
python -m modules.theme_collector.cli test-gemini

# Run Step 1 only (Community Analysis)
python -m modules.theme_collector.cli step1 <theme-slug> --inputs <path/to/inputs.json>

# Run full pipeline (Step 1 -> Step 2 -> Step 3 -> Cleanup -> Taxonomies -> Search Profile -> L1)
python -m modules.theme_collector.cli run <theme-slug> --inputs <path/to/inputs.json>

# Run pipeline + import to WordPress
python -m modules.theme_collector.cli full-run <theme-slug> --inputs <path> --import-wp --no-dry-run
```

## Validation

```bash
# L1 structural validation (automatic, also runs in pipeline)
python -m modules.theme_collector.cli validate <theme-slug>

# L2 editorial review -- generate artifact for Claude Code session
python -m modules.theme_collector.cli review <theme-slug>
# Then in Claude Code: "Review the L2 artifact for <theme>"

# Apply L2 verdicts (auto-merge high-confidence, flag rest)
python -m modules.theme_collector.cli apply-l2 <theme-slug>              # dry run
python -m modules.theme_collector.cli apply-l2 <theme-slug> --no-dry-run # apply

# Parity test (Step 1: Python vs Apps Script reference)
python -m modules.theme_collector.cli parity-test
python -m modules.theme_collector.cli parity-test --themes neve,astra,uncode
```

## WordPress Integration

```bash
# Test WP API connection
python -m modules.theme_collector.cli wp-test

# Resolve theme name -> WP post ID
python -m modules.theme_collector.cli resolve-id "Neve"

# Import to WordPress (dry run by default)
python -m modules.theme_collector.cli import <theme-slug>                  # dry run
python -m modules.theme_collector.cli import <theme-slug> --no-dry-run     # actual import
python -m modules.theme_collector.cli import <theme-slug> --no-dry-run --skip-validation  # override L1
```

## Stats Analyzer (GA4 + Clarity)

```bash
# Verify GA4 API access
python -m modules.stats_analyzer.cli verify --property-id 518707870

# Weekly overview (this week vs last week)
python -m modules.stats_analyzer.cli weekly --property-id 518707870

# Traffic sources
python -m modules.stats_analyzer.cli sources --property-id 518707870 --days 28

# LLM referrals (ChatGPT, Perplexity, Claude, etc.)
python -m modules.stats_analyzer.cli llm --property-id 518707870 --days 28

# Clarity (returns 500 with low traffic)
python -m modules.stats_analyzer.cli clarity-test
```

## Research (Reddit)

```bash
# Scan subreddits for relevant threads
python -m modules.research.cli scan --hours 72
```

## Orchestrator

```bash
# Start scheduler (blocks, runs tasks on schedule)
python -m modules.orchestrator.cli start

# Run all tasks immediately (GA4, Reddit, alerts, cost check)
python -m modules.orchestrator.cli run-now

# Show current state, open loops, today's alerts
python -m modules.orchestrator.cli status
```

## LLM Routing

```bash
# Test local LLM (Ollama + Qwen 2.5 14B)
python -m modules.theme_collector.cli test-local

# Show current routing table (cloud/local/none per step)
python -m modules.theme_collector.cli routing
```

---

## Dashboard

```bash
# Start local dashboard server
python serve.py --port 8080
# Open: http://127.0.0.1:8080/dashboard/
```
