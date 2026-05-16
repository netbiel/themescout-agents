---
name: themescout-weekly-pulse
description: Generate a weekly pulse report for the ThemeScout Agent project. Use this skill whenever the user asks for a "weekly pulse", "weekly report", "weekly digest", "this week's summary", or anything similar in the ThemeScout Agent repo. Also use it proactively at the start of any session that begins with "run weekly pulse", "what happened this week", or a date-based check-in (e.g. "let's do Monday review"). This is the primary recurring deliverable of the agent system, so consistency week-over-week matters more than creativity. Do not invent metrics that aren't grounded in actual data files.
---

# ThemeScout Weekly Pulse

The weekly pulse is the single most important recurring artifact of the ThemeScout Agent system. It is the user (Piotr's) main interface for steering the project — what needs his attention, what changed, what's coming next. It runs every week, so consistency week-over-week is critical: he needs to be able to glance at week N and week N+1 and immediately see what moved.

This skill encodes the workflow for generating it well.

## When to use this skill

Trigger phrases:
- "weekly pulse", "run weekly pulse", "generate weekly report"
- "what happened this week", "Monday review", "weekly digest"
- Any session opened on Monday morning in the ThemeScout Agent repo, where the previous Friday's pulse is older than 7 days

Do **not** use this skill for:
- Ad-hoc questions ("how's the project going?") — answer conversationally
- Daily reports — use the `daily-alert` pattern instead (separate concern)
- Monthly retros — those are written by Piotr, not the agent

## What the weekly pulse must contain

The pulse follows a fixed structure. Don't reorder sections — Piotr scans them in this order:

1. **🚨 Needs your action this week** — first because attention is scarce
2. **📊 Metrics** — what moved
3. **🔄 In progress / waiting on data** — open loops continuity
4. **🤖 What I'd do autonomously if I could** — transparency / trust calibration
5. **💰 Costs** — guardrails check
6. **📋 Next week plan** — commitments
7. **🔍 Notable observations** (optional)

The full template lives at `core/weekly-pulse-template.md` in the repo. Read it first if you have not already.

## Workflow

### Step 1: Read the project state

Before writing anything, load context in this order. Skipping any step risks generating a pulse that contradicts what already happened.

1. **`core/state.json`** — current sprint, baselines, open loops, last run timestamps, cost-to-date
2. **`core/decision-log.md`** — last 14 days of entries (filter by date). Pay special attention to:
   - DECISION entries (commitments made)
   - WARNING entries (unresolved issues)
   - ACTION entries (what the agent already did autonomously)
3. **Previous weekly pulse** — most recent file in `reports/weekly-pulse/`. The new pulse should reference it (e.g., "open loops from last week").
4. **`reports/daily/`** — any alerts from the past 7 days
5. **`data/pending-review/`** — what's waiting on Piotr
6. **`data/pipeline-runs.log`** (if exists) — cost data for the week

If any required file is missing, do not invent the data. Note the gap in the pulse explicitly: *"Could not load X — skipped."*

### Step 2: Compute metrics

The metrics table must use real numbers from data files. **Never estimate or fabricate.** If a metric source is unavailable, mark the cell as `n/a` and add a note.

Required metrics (these are the project's success metrics from `core/agent-charter.md`):

| Metric | Source |
|---|---|
| GSC clicks (last 7d) | `data/baseline/gsc-weekly-*.csv` or fresh export |
| GSC impressions (last 7d) | same |
| GA4 engaged sessions (last 7d) | `data/baseline/ga4-weekly-*.csv` or stats_analyzer module output |
| LLM citations count (last 7d) | derived from GA4 source/medium where source matches `chatgpt.com`, `perplexity.ai`, `claude.ai`, etc. |
| Cadence index | count of completed ACTION entries in decision log for the week |

Deltas: compute vs **last week** AND vs **baseline** (from `state.json`). Show both. A metric up vs last week but down vs baseline is a different story than both up.

Use `scripts/compute_deltas.py` (see `scripts/` folder in this skill) for arithmetic if numbers get fiddly.

### Step 3: Classify items into the right section

The hardest part of writing a good pulse is putting each item in the right section. Use these rules:

**Needs your action this week** — only if all three are true:
- Piotr needs to do something (review, approve, decide, post)
- It's blocking other progress, OR has a deadline this week
- The expected effort is bounded (e.g., "review 3 Reddit drafts: 10 min")

If any of those is false, the item goes elsewhere. Don't pad this section — its value comes from being short.

**What I'd do autonomously if I could** — items where the agent has a clear next action but is blocked by:
- Permission scope (charter says "Piotr decides")
- Cost guardrail (would push into orange/red zone)
- Confidence below threshold

This section is for *trust calibration*. It shows Piotr what the agent is thinking. Over time, items here may migrate to "autonomous action" if Piotr explicitly grants permission via decision-log.

**Notable observations** — only include if there's a real pattern worth surfacing. Skip the section if there isn't. Empty padding here is worse than no section.

### Step 4: Write costs section honestly

Costs section uses 4-tier zones from `core/cost-guardrails.md`:
- 🟢 Green: <$5/week
- 🟡 Yellow: $5–15
- 🟠 Orange: $15–30 (requires Piotr's GO for continuation)
- 🔴 Red: $30+/week OR $50+/month (auto-stop)

If the week's costs hit orange or red, the pulse must surface this in **Needs your action**, not bury it in the costs section.

### Step 5: Save and link

Save the pulse to: `reports/weekly-pulse/YYYY-MM-DD.md` (use Monday's date for the week start).

After saving:
1. Update `core/state.json`: set `last_weekly_pulse` to the file path and ISO timestamp
2. Add a `OBSERVATION` entry to `core/decision-log.md` noting the pulse was generated, with one-line summary of the dominant theme of the week

## Voice and tone

The pulse is read by one person (Piotr). It is not a public report. Write accordingly:

- Direct, no marketing speak. *"GSC clicks dropped 8% — likely the May 12 Google update"*, not *"We observed some interesting movement in our search performance"*.
- Acknowledge uncertainty. *"Cause unclear, but timing matches X"* is more useful than confident speculation.
- No padding. If a section is empty, say it's empty. Don't invent content.
- Don't compliment Piotr or hedge with helpful-bot phrases ("Great question!", "I'd be happy to..."). Just report.
- When recommending an action, give a concrete first step, not a category. *"Draft reply to thread X (link)"*, not *"Engage with Reddit community"*.

## Common failure modes to avoid

These have all happened in previous projects with similar reports. Learn from them.

1. **Fabricated metrics** — generating plausible numbers because data was missing. Always mark `n/a` instead.
2. **Section drift** — adding new sections that weren't in the template. If you think a new section is needed, propose it in next week's pulse as a meta-note, don't sneak it in.
3. **Recency bias** — over-weighting the last 1–2 days because they're fresh. The pulse covers 7 days; spread attention accordingly.
4. **Confirmation bias** — interpreting ambiguous data as supporting the agent's previous decisions. Cross-check decision-log: did you commit to X last week? Then ask honestly: is X working?
5. **Over-action** — listing 10 things in "Needs action". If everything is urgent, nothing is. Cap at 5; if more, the others become "In progress".

## Examples of good section content

**Good "Needs your action":**
```
- **Reddit thread review** — r/Wordpress thread on Kadence vs Astra (link), fit score 8/10
  - Draft reply ready: `data/pending-review/reddit-2026-05-14-kadence-vs-astra.md`
  - Why: thread is 18h old, peak engagement window closing
  - Review time: 5 min
```

**Bad "Needs your action":**
```
- We should think about strategy for Reddit engagement going forward
```

**Good metrics interpretation:**
```
GSC clicks 287 (↑12% vs last week, ↓3% vs baseline). Driver: Astra profile gained 4 positions on "astra theme review" query.
```

**Bad metrics interpretation:**
```
Traffic is trending positively this week, which is a great sign for our SEO strategy.
```

## Reference files

- `references/template.md` — exact pulse template (also at `core/weekly-pulse-template.md` in repo)
- `references/section-rules.md` — detailed rules for borderline classification decisions
- `scripts/compute_deltas.py` — helper for week-over-week + baseline arithmetic
