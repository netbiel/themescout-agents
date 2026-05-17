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

## 2026-05-16 | DECISION | Skill extraction strategy

Adopted iterative skill extraction policy: build skills only after a workflow has been done 2–3 times and a pattern is clear. Exception: `themescout-weekly-pulse` skill built upfront because the template already exists and weekly cadence will start immediately.

Watch list for future extraction:
- `themescout-agent-module` (after Sprint 1 + Sprint 3 — when 2 module patterns exist)
- `themescout-decision-protocol` (only if Claude shows logging inconsistency)

Rationale: premature skill creation produces brittle playbooks based on assumptions, not evidence.

## 2026-05-17 | DECISION | Validation architecture -- Path D (L1 Python + L2 in-session)

Three-layer validation system:
- L1 (Python, automatic): port of validateThemeJSON() -- structural, deterministic
- L2 (Claude Code session, manual trigger): editorial review by Claude in interactive session
- L3 (WordPress): existing Verify Dashboard -- unchanged

L2 trigger flow: CLI `review <theme>` generates artifact, Piotr opens Claude Code session, Claude writes verdicts, CLI `apply-l2 <theme>` auto-merges fields with confidence >= 0.95, flags rest for L3.

Auto-merge safety: original values preserved, audit logged, max 5 fields per theme, dry-run default.

## 2026-05-17 | DECISION | L1 validation moved from Sprint 5 to Sprint 4

Originally planned for Sprint 5 (Step 5.7). Moving to Sprint 4 because Sprint 4 produces first real Python outputs needing validation. L1 rules must exist before Sprint 5 fixes can reference them.

## 2026-05-17 | OBSERVATION | First L1 validation caught real bug in Neve output

L1 flagged performance_tier mismatch: tier='needs_work' but pagespeed_mobile=92 (should be 'excellent'). This is a pipeline/Gemini classification error that cleanup should fix. Validates the value of running L1 automatically.

## 2026-05-17 | DECISION | GA4 auth via OAuth instead of service account

Google Cloud Console error prevented service account creation. Switched to OAuth 2.0 flow (browser login, token cached). Functionally equivalent for our read-only use case.

## 2026-05-17 | DECISION | Reddit RSS fallback instead of PRAW API

Reddit killed self-service API keys in November 2025. New apps require manual approval. Built RSS fallback using public JSON feeds (reddit.com/r/X/new.json) -- no auth needed, sufficient for monitoring.

## 2026-05-17 | DECISION | Migrated from google-generativeai to google-genai SDK

Deprecated package. Gemini 2.5 Pro is a "thinking model" -- requires higher max_output_tokens (thinking tokens consume output budget). Minimum ~1000 tokens for simple responses.

## 2026-05-17 | DECISION | Apps Script decommission recommended

Sprint 6 retro recommends decommissioning Apps Script v3.20.3 as primary path. Python pipeline: 92.4% parity, $0.19/theme (vs $0.30-0.80), L1 validation, fully scriptable. Apps Script stays as emergency fallback. Awaiting Piotr's confirmation.

## 2026-05-17 | DECISION | Session wrapup skill created

Documentation drift detected after Sprint 0 -- README and docs outdated. Created `skills/session-wrapup/` to enforce docs sync at end of every productive session. Updates CURRENT-STATE.md, ARCHITECTURE.md (if changed), CLI-REFERENCE.md (if changed), and verifies decision-log completeness.

## 2026-05-17 | DECISION | Candidate Validator + PSI Fetcher architecture

Pre-pipeline validation: 2 new components in theme_collector module.

validator.py:
- Checks marketplace_url, vendor_url, demo_url reachability (HTTP 2xx/3xx)
- PSI API test call to verify demo is measurable
- Bot protection detection (captcha, Cloudflare challenge)
- Atomic writes for resume capability
- Input: data/candidates/input/<batch>.json
- Output: data/candidates/validated/<batch>.json

psi_fetcher.py:
- 3 runs mobile + 3 runs desktop per theme (6 PSI calls total)
- Median of 3 runs for all metrics (score, LCP, CLS)
- Variance tracking: flags themes >10 point spread for re-verification
- 5s pause between calls (rate limit + reduce correlation)
- Output: data/candidates/base-json/<slug>.json with pagespeed_data

PSI API key: reuses Gemini API key (same Google Cloud project). Requires PageSpeed Insights API enabled in Cloud Console.

## 2026-05-17 | BLOCKED | PSI API not enabled for current API key

PageSpeed Insights API returns "blocked" for current Gemini API key. Need to enable it in Google Cloud Console -> APIs & Services -> Library -> PageSpeed Insights API -> Enable.

## 2026-05-17 | DECISION | PSI API -- osobny klucz, batch validation deferred

PSI API wymaga osobnego klucza (Gemini key ma restrykcje). Klucz w .secret/psi_api_key.txt. Validator + PSI Fetcher verified on Neve (55mob/86desk). Batch validation na pelnym katalogu przesuniety -- wrocimy po wdrozeniu dalszych specyfikacji.

## 2026-05-17 | DECISION | Sprint 1.5: Clarity MCP server added

Configured @microsoft/clarity-mcp-server in Claude Code project config. Ad-hoc Clarity queries during sessions. Python client remains for scheduled use.

Routing: weekly pulse/dashboard -> Python client. Interactive investigation -> MCP.
Quota: 10 calls/day shared between Python + MCP. Both use same token.

---

<!-- New entries below this line. Format: ## YYYY-MM-DD | TYPE | One-line title -->
