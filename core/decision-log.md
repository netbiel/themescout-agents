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

---

<!-- New entries below this line. Format: ## YYYY-MM-DD | TYPE | One-line title -->
