# ThemeScout Agent

A modular AI agent system for running ThemeScout (themescout.pro) with human-in-the-loop.

## Hypothesis

Does a regularly-running agent team with human-in-the-loop outperform a human who only occasionally updates and verifies the site?

## Architecture

- **Modules** (`modules/`): autonomous data collectors and processors
  - `theme_collector/` — fetches theme data via APIs/scraping
  - `stats_analyzer/` — processes GA4 + Clarity data
  - `research/` — Reddit + community monitoring
- **Core** (`core/`): agent constitution, state, decision log
- **Dashboard** (`dashboard/`): local web UI for review and approvals
- **Reasoning**: happens in Claude Code sessions triggered by the user

## Constraints

- All external APIs are read-only (GA4, Reddit, Sheets)
- WordPress writes = drafts only (initially)
- Claude reasoning via interactive Claude Code sessions (no API key in scripts)
- Local LLM (Qwen 2.5 14B / Llama 3.1 8B) handles classification + filtering

## Sprint plan

- [x] Sprint 0: Foundation (this sprint)
- [ ] Sprint 1: Stats Analyzer
- [ ] Sprint 2: Dashboard MVP
- [ ] Sprint 3: Research module (Reddit API)
- [ ] Sprint 4: Theme Collector
- [ ] Sprint 5: Orchestration + local LLM + scheduler

## Quick start

```bash
# 1. Setup venv
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# 2. Install
pip install -r requirements.txt

# 3. Configure secrets
cp config/secrets.env.example config/secrets.env
# Fill in API keys (GA4 service account, Reddit, etc.)

# 4. Start a session
claude
```

See `core/agent-charter.md` for what the agent does and does not do.
