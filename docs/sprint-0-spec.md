# Sprint 0 Spec — ThemeScout Agent Foundation

**For:** Claude Code, executed in an empty directory  
**By:** Piotr (piotr_wpdev) — ThemeScout owner  
**Date:** 2026-05-16

---

## Step 0 — Read this entire spec before doing anything

This document is the constitution for a new project: a modular AI agent system that helps Piotr run ThemeScout (a WordPress theme review/comparison site) more regularly than he currently does solo.

**Do not deviate from this spec without explicit user confirmation.** If something is ambiguous, ask before acting.

After reading, execute steps 1–5 in order. At the end, run the verification checklist (Step 6) and report back.

---

## Project context

### What we're building

A modular agent system, running locally on Piotr's machine, that:
- Collects theme data via API/scraping (Module 1: Theme Collector)
- Analyzes stats from GA4 + Clarity (Module 2: Stats Analyzer)
- Researches Reddit + other sources (Module 3: Research)
- Renders reports + pending actions on a local dashboard (Module 4: Dashboard)
- Is orchestrated by Claude (via Claude Code sessions triggered by Piotr) — not by an API key in scripts

### Hypothesis being tested

**"Czy regularnie działający zespół agentów z człowiekiem w pętli jest lepszy niż człowiek, który sporadycznie robi aktualizacje i weryfikacje."**

(Does a regularly-running agent team with human-in-the-loop outperform a human who only occasionally updates and verifies the site.)

This is an **educational experiment**. Success = generating a defensible answer to that hypothesis, regardless of direction. Negative results are valid outcomes.

### Hard constraints (do not violate)

1. **Claude reasoning lives in interactive Claude Code sessions** — Piotr has a Claude Max subscription. No Anthropic API key in any script. Reasoning happens when Piotr runs `claude` in this directory.
2. **All external APIs are read-only** (Google Analytics 4, Reddit, Google Sheets). No write operations to external services except WordPress (drafts only initially).
3. **WordPress writes = drafts only** at the start. Every agent-generated post gets metadata: `_agent_generated: true`, `_agent_confidence: 0.0-1.0`, `_agent_sources: [...]`.
4. **Local LLM** (Qwen 2.5 14B or Llama 3.1 8B on RTX 5070 Ti, 16GB VRAM) handles automation reasoning: classification, filtering, summarization. Claude (in sessions) handles judgment, planning, drafting.
5. **No silent autonomous WordPress publish.** Even after we relax draft-only later, publish requires explicit Piotr approval through the dashboard or session.
6. **Cost guardrails enforced** per `cost-guardrails.md` (created in Step 2).

### Tech stack decisions (already made)

- Python 3.11+
- Click for CLI
- SQLite for state (transactional, single-file, no server)
- Markdown for human-readable reports
- YAML for configs
- Static SPA dashboard (Vite + React or plain HTML/JS — TBD in dashboard sprint)
- Git + GitHub private repo

---

## Step 1 — Create repo structure

Create the following directory and file structure in the current working directory. **Do not skip empty directories** — create them with `.gitkeep` files where needed.

```
themescout-agent/
├── .gitignore
├── README.md
├── pyproject.toml
├── requirements.txt
├── .env.example
├── core/
│   ├── __init__.py
│   ├── agent-charter.md
│   ├── agent-permissions.md
│   ├── cost-guardrails.md
│   ├── decision-log.md
│   ├── state.json
│   └── weekly-pulse-template.md
├── modules/
│   ├── __init__.py
│   ├── theme_collector/
│   │   └── .gitkeep
│   ├── stats_analyzer/
│   │   └── .gitkeep
│   └── research/
│       └── .gitkeep
├── dashboard/
│   ├── index.html
│   └── README.md
├── reports/
│   ├── daily/
│   │   └── .gitkeep
│   └── weekly-pulse/
│       └── .gitkeep
├── data/
│   ├── baseline/
│   │   └── .gitkeep
│   ├── cache/
│   │   └── .gitkeep
│   └── pending-review/
│       └── .gitkeep
├── config/
│   ├── target_themes.yaml
│   ├── reddit_subreddits.yaml
│   └── secrets.env.example
└── docs/
    └── sprint-0-spec.md  (copy of this file)
```

After creating: run `cd themescout-agent` and confirm structure with `tree -a -L 2` (or `find . -maxdepth 2`).

---

## Step 2 — Create foundation files

### File: `.gitignore`

```
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
build/
dist/
*.egg-info/
venv/
.venv/
env/

# Secrets — NEVER commit
config/secrets.env
*.key
*.pem
service-account*.json

# Local data
data/cache/
data/baseline/raw/
*.sqlite
*.db

# Reports (generated, but keep folder)
reports/daily/*
reports/weekly-pulse/*
!reports/daily/.gitkeep
!reports/weekly-pulse/.gitkeep

# IDE
.idea/
.vscode/
*.swp
.DS_Store

# Logs
*.log
logs/
```

### File: `README.md`

```markdown
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
```

### File: `pyproject.toml`

```toml
[project]
name = "themescout-agent"
version = "0.1.0"
description = "Modular AI agent for ThemeScout with human-in-the-loop"
requires-python = ">=3.11"
dependencies = []

[project.optional-dependencies]
dev = ["pytest", "ruff", "black"]

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.black]
line-length = 100
target-version = ["py311"]
```

### File: `requirements.txt`

```
# Will be populated per-sprint. Sprint 0 = empty.
# Sprint 1 will add: google-analytics-data, pandas, click
# Sprint 3 will add: praw
# Sprint 5 will add: schedule, ollama (or llama-cpp-python)
```

### File: `.env.example`

```
# Sprint 1+: GA4 service account
GA4_SERVICE_ACCOUNT_JSON=path/to/service-account.json
GA4_PROPERTY_ID=

# Sprint 3+: Reddit API
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_USER_AGENT=themescout-agent/0.1 by piotr_wpdev

# Sprint 4+: WordPress (optional, can use application passwords)
WP_BASE_URL=https://themescout.pro
WP_USERNAME=
WP_APP_PASSWORD=
```

### File: `core/agent-charter.md`

```markdown
# Agent Charter

**Version:** 1.0  
**Date:** 2026-05-16  
**Status:** Active

## Mission

Help Piotr run ThemeScout (themescout.pro) more regularly and systematically than he currently does solo, by combining:
- Automated data collection and pre-filtering (modules + local LLM)
- Claude reasoning in interactive sessions (judgment, drafting, planning)
- Human approval gate for all consequential actions (Piotr)

## Hypothesis being tested

**"Czy regularnie działający zespół agentów z człowiekiem w pętli jest lepszy niż człowiek, który sporadycznie robi aktualizacje i weryfikacje."**

This is an **educational experiment**. Success = a defensible answer to the hypothesis, in either direction. Negative results are valid outcomes.

## Scope — what the agent does

- Collects theme data from web sources (Module 1)
- Pulls and analyzes GA4 metrics + Clarity insights (Module 2)
- Monitors Reddit and other communities for discussion threads relevant to themes Piotr covers (Module 3)
- Generates weekly pulse reports with metrics, action items, and recommendations
- Drafts WordPress posts and updates (subject to Piotr's review)
- Drafts Reddit replies (subject to Piotr's review and posting)
- Maintains decision log and state across sessions

## Scope — what the agent does NOT do

- **Strategy:** does not decide whether to build Treefse, change pricing model, reposition ThemeScout, etc.
- **Reddit posting:** drafts only — Piotr posts
- **WordPress publish:** drafts only initially — Piotr publishes (this may relax after several weeks of stable operation, by explicit decision logged in `decision-log.md`)
- **Adding profiles outside the agreed list:** the closed list of 5–8 niche premium themes (Uncode, Salient, BeTheme, Bridge, Jupiter X, The7) is the boundary. New additions require Piotr's explicit decision.
- **Taxonomy changes:** does not modify WordPress taxonomies, ACF field structures, or schema templates without explicit approval.
- **Anything outside ThemeScout:** does not touch Treefse, agency work, or unrelated projects.

## Success criteria (3 metrics)

Baselines to be filled in once Piotr provides GSC/GA4/Clarity data.

| Metric | Baseline | Target (3mo) | Why |
|---|---|---|---|
| **Weekly cadence of meaningful updates** (profile updates, content publishes, Reddit engagements) | TBD | 5+/week sustained | Direct test of "regular vs sporadic" hypothesis |
| **LLM citation count** (unique sources where ThemeScout content is cited by ChatGPT/Perplexity/etc., visible in utm tracking + bot tracking from WPAgent AI Optimizer) | TBD | +50% | Strategic distribution channel from memory |
| **Engaged organic sessions** (GA4: sessions with engagement_time > 30s from organic + AI search) | TBD | +30% | Validates that increased cadence translates to user value, not just noise |

Metrics deliberately exclude conversion/affiliate revenue at this stage — sample size too small for reliable signal at current traffic volume.

## Checkpoint protocol

**No hard timebox.** Instead:

- **Monthly retro** (last Friday of each month): Piotr writes a 3-sentence retro: what works, what doesn't, what learned. Lives in `core/decision-log.md` as a `RETRO` entry.
- **Checkpoint 1** (~week 4): Review whether any signal is visible on the 3 metrics. If totally silent: adjust metrics or change approach.
- **Checkpoint 2** (~week 8): Continue / pivot / stop decision. Pre-defined criteria below.
- **Soft warning trigger:** 4 consecutive weeks with no measurable progress on any of the 3 metrics → agent generates `WARNING.md` flagging this and pauses autonomous draft generation until Piotr responds.

### Continue / pivot / stop criteria

- **Continue:** ≥2 of 3 metrics showing positive movement vs baseline
- **Pivot:** 1 of 3 metrics improving + clear hypothesis why others lag → adjust modules
- **Stop:** 0 of 3 metrics improving after 8 weeks + no compelling qualitative reason to continue
- **Override:** Piotr can override any of the above based on qualitative judgment, logged in `decision-log.md`

## Bias safeguards

The agent (Claude) is helpful-trained and may exhibit:
- Confirmation bias when interpreting its own past decisions
- Tendency to recommend action over inaction
- Drift from Piotr's product vision in pursuit of measurable metrics

Mitigations:
- **Mandatory reporting:** the following are always reported even if Claude judges them low-priority — pipeline errors, schema validation failures, metric drops >10% week-over-week, cost spikes, any action that contradicts a previous decision in the log
- **Decision log is append-only.** Past decisions are not edited. Reversals create new entries citing the old.
- **Piotr's monthly retro is the human external check** the agent cannot provide for itself

## Authority hierarchy

When in conflict:
1. **Piotr's explicit instruction in current session** > everything
2. **This charter** > Claude's session-level judgment
3. **`agent-permissions.md`** > Claude's interpretation of "what's helpful"
4. **`cost-guardrails.md`** > pipeline run decisions
5. **`decision-log.md` precedent** > Claude's fresh judgment on similar matter
```

### File: `core/agent-permissions.md`

```markdown
# Agent Permissions

**Version:** 1.0  
**Date:** 2026-05-16

## Filesystem

| Path | Permission |
|---|---|
| `themescout-agent/` (this repo) | Read + Write |
| Anywhere outside this repo | Read only, and only when explicitly needed for context |
| `config/secrets.env` | Read only; never echoed in logs/reports |

## External APIs

| API | Permission | Notes |
|---|---|---|
| Google Analytics 4 Data API | **Read only** | Service account scoped to GA4 read |
| Google Search Console API | **Read only** | Future addition |
| Reddit API (PRAW) | **Read only** | No posting, voting, commenting |
| Google Sheets API | **Read only** | For pipeline data sources |
| WordPress REST API | **Write: drafts only** | All posts default to `status: draft`, never `publish` |
| Anthropic API | **Not used** | All Claude reasoning via interactive Claude Code sessions |
| Local LLM (Ollama / llama-cpp) | Full local use | No external calls |

## WordPress writes — specific rules

- Status: always `draft` on creation
- Required metadata on every agent-generated post:
  - `_agent_generated: true`
  - `_agent_confidence: 0.0–1.0` (Claude's self-assessment)
  - `_agent_sources: [list of URLs/IDs]`
  - `_agent_session_id: <id>` (link back to decision-log entry)
- Forbidden until explicit Piotr approval (logged in decision-log):
  - Publishing drafts
  - Modifying ACF taxonomy structures
  - Bulk operations affecting >3 posts at once
  - Modifying `_agent_*` metadata on existing posts (audit integrity)

## Pipeline runs

Governed by `cost-guardrails.md`. Summary:
- Up to 3 profile runs per week without explicit approval, within green cost zone
- Batch >3 → requires Piotr's GO via dashboard or Dispatch
- Hard stop on red cost zone

## Information that must NEVER be logged

- API keys, tokens, service account JSON contents
- WordPress passwords (use application passwords only)
- Piotr's personal email content beyond explicit references
- Full content of Reddit users' DMs (if any are ever surfaced — unlikely with read-only API)

## What Claude must NEVER do without explicit confirmation

- Run any command that deletes files (`rm`, `git reset --hard`, etc.)
- Push to remote (`git push`) without Piotr's explicit go in the current session
- Modify files in `core/` after Sprint 0 — these are constitutional
- Skip writing to `decision-log.md` when making a non-trivial decision
- Run pipeline batches outside green zone

## Escalation

When uncertain whether an action falls within permissions: do not act, write a note in `core/decision-log.md` as a `BLOCKED` entry, and surface in next weekly pulse.
```

### File: `core/cost-guardrails.md`

```markdown
# Cost Guardrails

**Version:** 1.0  
**Date:** 2026-05-16

## Calibration period

**First 2–3 weeks: data collection only.** Piotr will manually verify each pipeline run cost. After this period, this document will be updated with actual baselines.

## Cost zones

Estimates based on memory: ~$0.30–$0.80 per profile pipeline run (Gemini Pro + Perplexity).

| Zone | Weekly spend | Behavior |
|---|---|---|
| 🟢 Green | < $5 | Normal operation, no alert |
| 🟡 Yellow | $5–$15 | Weekly pulse includes cost breakdown table |
| 🟠 Orange | $15–$30 | Dispatch notification: "Weekly cost $X. Continue?" — requires Piotr's GO |
| 🔴 Red | $30+/week OR $50+ cumulative for the month | Automatic stop on pipeline runs. Requires Piotr's explicit unblock. |

## Cost tracking — required practice

Every pipeline run logs to `data/pipeline-runs.log`:

```
[ISO timestamp] | profile_slug | tokens_in | tokens_out | estimated_cost_usd | session_id | trigger (auto|manual)
```

Sum aggregated:
- Weekly: in every weekly pulse report
- Monthly: in monthly retro section of decision log

## Override mechanism

Piotr can:
- Pre-authorize a specific batch (e.g., "GO ahead with 8-profile batch for niche premium themes"), logged in decision-log
- Adjust zone thresholds (edit this file, increment version, note reason)
- Unblock red zone with explicit instruction in session

## What counts as "cost"

- Gemini Pro API calls (pipeline)
- Perplexity API calls (research)
- Any future paid API (Apify, etc.)

**Not counted:**
- Claude Max subscription (flat rate)
- Local LLM (electricity only)
- Free-tier APIs (Reddit, GA4 within quota)
```

### File: `core/decision-log.md`

```markdown
# Decision Log

**Format:** Append-only. Each entry is a decision, observation, or retro. Never edit past entries — create reversal entries citing the original.

---

## Entry types

- `DECISION` — a deliberate choice with rationale
- `OBSERVATION` — a notable data point or pattern
- `ACTION` — something the agent did autonomously
- `BLOCKED` — agent wanted to act but lacked permission/clarity
- `RETRO` — Piotr's monthly retro
- `WARNING` — agent-generated alert (failed checkpoint, anomaly)
- `OVERRIDE` — Piotr overrides previous decision/criterion

---

## 2026-05-16 | DECISION | Project inception

**Context:** After several weeks of Piotr-led ThemeScout work with sporadic updates, decided to test whether agent-driven regular operation outperforms current cadence.

**Hypothesis:** Czy regularnie działający zespół agentów z człowiekiem w pętli jest lepszy niż człowiek, który sporadycznie robi aktualizacje i weryfikacje.

**Frame:** Educational experiment. Negative results are valid.

**Authority:** Piotr (owner).

## 2026-05-16 | DECISION | Architecture choices

- Modular Python app, local execution on Piotr's machine
- Claude reasoning via interactive sessions (Claude Max sub), not API key
- Local LLM (Qwen 2.5 14B / Llama 3.1 8B on RTX 5070 Ti, 16GB VRAM) for classification/filtering
- All external APIs read-only
- WordPress writes = drafts only
- Static SPA dashboard (Vite or plain JS — final choice in Sprint 2)
- GitHub private repo + local

## 2026-05-16 | DECISION | Sprint sequence

0. Foundation (this sprint) — charter, permissions, structure
1. Stats Analyzer — GA4 + Clarity
2. Dashboard MVP — visualize Sprint 1
3. Research — Reddit API
4. Theme Collector — integrate with existing pipeline
5. Orchestration + local LLM + scheduler

**Rationale:** measurement first (Stats), then visualization (Dashboard), then automation (Research, Collector), then orchestration. Each sprint produces a usable artifact.

## 2026-05-16 | DECISION | Cost guardrails

4-tier system (green/yellow/orange/red). First 2–3 weeks = calibration. See `cost-guardrails.md`.

## 2026-05-16 | DECISION | ThemeScout pause accepted

Piotr accepts 2–4 weeks of ThemeScout downtime to build the agent infrastructure. Tradeoff is explicit and acknowledged.

## 2026-05-16 | BLOCKED | Baseline data not yet provided

Cannot fill in baseline values in `agent-charter.md` success metrics table until Piotr provides GSC/GA4/Clarity exports. Will request again at Sprint 1 kickoff.

---

<!-- New entries below this line. Format: ## YYYY-MM-DD | TYPE | One-line title -->
```

### File: `core/state.json`

```json
{
  "schema_version": "1.0",
  "last_updated": "2026-05-16T00:00:00Z",
  "current_sprint": 0,
  "sprint_status": "in_progress",
  "open_loops": [
    {
      "id": "baseline-data",
      "description": "Awaiting GSC/GA4/Clarity baseline data from Piotr",
      "blocker": true,
      "created": "2026-05-16"
    }
  ],
  "baselines": {
    "gsc_clicks_28d": null,
    "gsc_impressions_28d": null,
    "ga4_sessions_28d": null,
    "ga4_engaged_sessions_28d": null,
    "llm_citations_count": null,
    "rich_snippets_count": null,
    "captured_at": null
  },
  "last_run": null,
  "next_scheduled_run": null,
  "pending_review_count": 0,
  "drafts_awaiting_publish": 0,
  "cost_week_to_date_usd": 0.0,
  "cost_month_to_date_usd": 0.0,
  "active_warnings": []
}
```

### File: `core/weekly-pulse-template.md`

```markdown
# Weekly Pulse — Week of [YYYY-MM-DD]

**Generated:** [ISO timestamp]  
**Session ID:** [id]  
**Sprint:** [N]

---

## 🚨 Needs your action this week

(High-priority items requiring Piotr's review/approval. Empty if none.)

- **[Action type]** — [one-line description]
  - Why: [reason]
  - Draft / spec: [link to file]
  - Estimated review time: [N min]

---

## 📊 Metrics

| Metric | This week | Last week | Δ | vs Baseline |
|---|---|---|---|---|
| GSC clicks | | | | |
| GSC impressions | | | | |
| GA4 engaged sessions | | | | |
| LLM citations (unique) | | | | |
| Cadence index (actions completed) | | | | |

[Brief narrative on what changed and why, if known]

---

## 🔄 In progress / waiting on data

(Open loops from previous weeks, status update each)

- [ ] [Item]: [status]

---

## 🤖 What I'd do autonomously if I could

(Transparency: actions Claude considered but flagged for Piotr's approval. Helps calibrate trust.)

- [Action]: [why it would help] / [why I'm not doing it]

---

## 💰 Costs

| Item | This week | Month to date |
|---|---|---|
| Pipeline runs | $X.XX | $X.XX |
| Perplexity | $X.XX | $X.XX |
| Other | $X.XX | $X.XX |
| **Total** | $X.XX | $X.XX |

Zone: 🟢 / 🟡 / 🟠 / 🔴

---

## 📋 Next week plan

(What I plan to do next week unless Piotr says otherwise)

- [Action] — [why]
- [Action] — [why]

---

## 🔍 Notable observations

(Patterns, anomalies, learnings worth noting. Optional section.)
```

### File: `config/target_themes.yaml`

```yaml
# Themes currently profiled on ThemeScout (44 published as of 2026-05-16)
# This file tracks the catalog. Editing requires a DECISION entry in decision-log.md.

# Closed list — additions only via approved expansion
published:
  # Existing 44 — to be enumerated by Piotr in Sprint 4 setup
  # Placeholder; will be populated when Theme Collector module is built
  - slug: placeholder
    name: "TBD — Piotr to populate"

# Niche premium expansion (approved 2026-05-16, max 5–8)
expansion_approved:
  - slug: uncode
    name: Uncode
    status: pending
    rationale: LLM citation potential, low competition
  - slug: salient
    name: Salient
    status: pending
    rationale: LLM citation potential, low competition
  - slug: betheme
    name: BeTheme
    status: pending
    rationale: LLM citation potential, niche premium
  - slug: bridge
    name: Bridge
    status: pending
    rationale: LLM citation potential, niche premium
  - slug: jupiter-x
    name: Jupiter X
    status: pending
    rationale: LLM citation potential, niche premium
  - slug: the7
    name: The7
    status: pending
    rationale: LLM citation potential, niche premium

# Beyond this list: requires new DECISION entry
```

### File: `config/reddit_subreddits.yaml`

```yaml
# Subreddits monitored by Research module
# Each entry: subreddit + relevance score + keywords filter

# To be finalized by Piotr in Sprint 3 kickoff. Initial draft below.

monitored:
  - name: Wordpress
    priority: high
    keywords: [theme, template, page builder, kadence, astra, elementor, gutenberg, fse, block theme]
  - name: ProWordPress
    priority: high
    keywords: [theme, custom theme, child theme, performance, lighthouse]
  - name: web_design
    priority: medium
    keywords: [wordpress theme, theme recommendation, design system]
  - name: webdev
    priority: low
    keywords: [wordpress, theme]

# Engagement framework reference (from Piotr's memory):
# - Evaluate thread fit first (freshness, audience match, expertise angle)
# - Skip dead/off-topic/promotional-bait threads
# - Post Tuesday–Thursday 9–11 EST
# - 3–4 sentence posts, one question or debatable opinion
# - No direct promotion; ThemeScout mention only when another user explicitly asks
```

### File: `config/secrets.env.example`

```
# Copy this file to secrets.env and fill in values. secrets.env is gitignored.

# Google Analytics 4
GA4_SERVICE_ACCOUNT_JSON_PATH=
GA4_PROPERTY_ID=

# Google Search Console (future)
GSC_SERVICE_ACCOUNT_JSON_PATH=

# Reddit API (PRAW)
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_USER_AGENT=themescout-agent/0.1 by piotr_wpdev
REDDIT_USERNAME=
REDDIT_PASSWORD=

# WordPress
WP_BASE_URL=https://themescout.pro
WP_USERNAME=
WP_APP_PASSWORD=

# Pipeline (existing system)
GEMINI_API_KEY=
PERPLEXITY_API_KEY=

# Local LLM (Ollama default endpoint)
OLLAMA_BASE_URL=http://localhost:11434
LOCAL_LLM_MODEL=qwen2.5:14b
```

### File: `dashboard/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ThemeScout Agent — Dashboard (placeholder)</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      max-width: 720px;
      margin: 4rem auto;
      padding: 0 1.5rem;
      color: #1a1a1a;
      background: #fafaf8;
      line-height: 1.6;
    }
    h1 { font-weight: 600; }
    code {
      background: #ebebe8;
      padding: 0.1em 0.3em;
      border-radius: 3px;
      font-size: 0.92em;
    }
    .placeholder {
      background: #fff;
      border: 1px solid #ddd;
      padding: 1.5rem;
      border-radius: 8px;
      margin-top: 2rem;
    }
  </style>
</head>
<body>
  <h1>ThemeScout Agent</h1>
  <p>Dashboard placeholder — to be built in Sprint 2.</p>

  <div class="placeholder">
    <strong>Coming soon:</strong>
    <ul>
      <li>Live status (last run, next run, cost zone)</li>
      <li>Pending review queue (Reddit drafts, WP drafts, pipeline outputs)</li>
      <li>Metrics trend (vs last week, vs baseline)</li>
      <li>Recent activity stream</li>
      <li>Navigation: Reports / Decision Log / Drafts / State</li>
    </ul>
  </div>

  <p style="margin-top: 2rem; font-size: 0.9em; color: #666;">
    For now, see <code>core/agent-charter.md</code> and <code>core/decision-log.md</code> for system status.
  </p>
</body>
</html>
```

### File: `dashboard/README.md`

```markdown
# Dashboard

Local static SPA for ThemeScout Agent reporting and approvals.

## Status

Placeholder only (Sprint 0). Full build in Sprint 2.

## Planned architecture (Sprint 2)

- Static HTML/JS or Vite + React (decided at Sprint 2 kickoff)
- Reads JSON from `../data/` and Markdown from `../reports/`
- No backend — served via `python -m http.server 8000` from this folder
- No auth (localhost only)

## Future (Sprint 5+, if needed)

- Upgrade to FastAPI backend if interactive approvals from the dashboard become important
```

---

## Step 3 — Setup Python project

```bash
# Inside themescout-agent/
python -m venv venv

# Activate (Linux/macOS)
source venv/bin/activate
# Windows
# venv\Scripts\activate

# Sprint 0 has empty requirements.txt — nothing to install yet
# Just verify pip works
pip --version
```

**Do not** install anything beyond what's in `requirements.txt` (which is empty in Sprint 0). Sprint 1 will add GA4 deps.

---

## Step 4 — Initial git commit

```bash
git init
git branch -M main

# Stage everything
git add .
git status  # verify .gitignore is working — config/secrets.env should NOT appear

git commit -m "Sprint 0: foundation (charter, permissions, structure)"
```

**Do not push yet.** Piotr will create the GitHub private repo and provide the remote URL in a follow-up step. Wait for explicit instruction.

---

## Step 5 — Copy this spec into the repo

```bash
# Assuming this spec was provided to Claude Code as input file:
cp <path-to-sprint-0-spec.md> docs/sprint-0-spec.md
git add docs/sprint-0-spec.md
git commit -m "docs: archive Sprint 0 spec"
```

If the spec is in a non-standard location, ask Piotr for the path.

---

## Step 6 — Verification checklist

Before reporting completion, verify each item. Report each as ✅ or ❌ with notes.

- [ ] Directory `themescout-agent/` exists
- [ ] All folders from Step 1 tree exist (including empty ones with `.gitkeep`)
- [ ] All files from Step 2 exist with correct content
- [ ] `.gitignore` includes `config/secrets.env`
- [ ] `config/secrets.env` does NOT exist (only `.example`)
- [ ] `git status` shows clean working tree after initial commit
- [ ] `core/decision-log.md` has 5 inception entries from 2026-05-16
- [ ] `core/state.json` parses as valid JSON (run `python -c "import json; json.load(open('core/state.json'))"`)
- [ ] `dashboard/index.html` opens in browser with placeholder content
- [ ] Python venv created and activatable
- [ ] No secrets, API keys, or service account contents anywhere in the repo

---

## Step 7 — Report back

After completing Steps 1–6, generate a short report:

```markdown
# Sprint 0 — Completion Report

**Repo path:** [absolute path]  
**Git commit hash:** [hash]  
**Verification:** X/11 passed

## Notes
[Anything that needed deviation from spec, or questions for Piotr]

## Next steps
1. Piotr creates GitHub private repo, provides remote URL
2. Push initial commit
3. Piotr provides baseline data (GSC, GA4, Clarity) — needed for Sprint 1
4. Schedule Sprint 1 kickoff session
```

---

## What you (Claude Code) should NOT do

- Do not install Python packages beyond what's in requirements.txt (empty in Sprint 0)
- Do not create files outside the structure defined in Step 1
- Do not skip the verification checklist
- Do not push to GitHub without explicit instruction
- Do not modify this spec
- Do not start Sprint 1 work — that's a separate session

---

## End of Sprint 0 spec
