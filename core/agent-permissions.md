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
