# Skills

Operational playbooks for recurring agent workflows. Claude Code consults skills when triggers match.

## Active skills

- `themescout-weekly-pulse/` — Weekly pulse report generation. Triggered by "weekly pulse", "weekly report", or Monday session start.
- `session-wrapup/` — End-of-session documentation sync. Triggered by "wrapup", "zakoncz sesje", "update docs", or end of productive session.

## Adding new skills

New skills are added iteratively, after a workflow has been performed manually 2–3 times and a pattern has emerged. Premature skill creation produces brittle playbooks. See `core/decision-log.md` for the meta-decision on skill cadence.

Candidates being watched for skill extraction (Sprint 1–5):
- `themescout-agent-module` — pattern for building new modules (after Sprint 1 + 3 done)
- `themescout-decision-protocol` — logging conventions (only if compliance drift observed)
