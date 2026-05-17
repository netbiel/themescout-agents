---
name: session-wrapup
description: End-of-session documentation sync. Use this skill when the user says "zakoncz sesje", "session wrap-up", "wrapup", "podsumuj sesje", "koniec na dzis", "update docs", "aktualizuj docs", or at the end of any productive session where code was changed. This skill ensures documentation stays in sync with actual code and decisions are logged. Do not skip steps — documentation drift is the #1 maintenance risk for this project.
---

# Session Wrapup

Keeps documentation in sync with code changes made during a session.

## When to use

- End of every productive session (code changes, new features, decisions)
- When user explicitly asks: "update docs", "aktualizuj docs", "wrapup"
- Before handing off to a different context (new day, new topic)

Do NOT use for:
- Sessions that only read/explored code without changes
- Quick Q&A sessions with no commits

## Workflow

### Step 1: Gather session changes

```bash
# What changed since session start (or last wrapup)
git log --oneline -20
git diff --stat HEAD~N  # N = number of commits this session
```

Identify:
- New files/modules added
- Existing modules modified
- New CLI commands
- Decisions made (explicit or implicit)
- Bugs fixed
- Config changes

### Step 2: Update CURRENT-STATE.md

File: `docs/CURRENT-STATE.md`

Always update:
- Sprint Progress table (status, dates)
- Pending Decisions (add new, resolve old)
- Open Blockers (add new, close resolved)
- Cost Tracking (from data/llm-calls.log if pipeline ran)
- Key Metrics (if stats_analyzer ran)
- File Counts (if modules changed)
- "Last updated" date at top

Rules:
- Keep factual, no speculation
- Numbers from actual data (git, logs, validation results)
- Remove resolved blockers, don't just mark them

### Step 3: Update ARCHITECTURE.md (if structure changed)

File: `docs/ARCHITECTURE.md`

Only update if:
- New module or submodule added
- Data flow changed
- New external dependency
- Validation layer modified
- New config file

Check by comparing current module listing vs what's documented:
```bash
find modules/ -name "*.py" -not -path "*__pycache__*" | sort
```

If no structural changes, skip this step entirely.

### Step 4: Update CLI-REFERENCE.md (if commands changed)

File: `docs/CLI-REFERENCE.md`

Only update if:
- New CLI command added
- Command signature changed (new options/arguments)
- Command removed

Check by scanning cli.py files:
```bash
grep -n "@cli.command" modules/*/cli.py modules/*/*/cli.py 2>/dev/null
```

### Step 5: Verify decision-log.md completeness

File: `core/decision-log.md`

Scan session commits for decisions that should be logged:
- Architecture choices ("we'll use X instead of Y")
- Deferred work ("skip Z for now because...")
- Bug workarounds ("Gemini returns X, we handle it by...")
- Scope changes ("adding/removing feature")
- Override of existing rules

For each unlogged decision:
- Add entry with format: `## YYYY-MM-DD | TYPE | One-line title`
- Types: DECISION, OBSERVATION, ACTION, BLOCKED
- Include rationale, not just what was decided

Do NOT log:
- Routine code changes (that's what git is for)
- Typo fixes
- Refactoring without behavioral change

### Step 6: Commit documentation updates

```bash
git add docs/CURRENT-STATE.md docs/ARCHITECTURE.md docs/CLI-REFERENCE.md core/decision-log.md
git commit -m "docs: session wrapup [date] — [1-line summary of session]"
```

Only include files that actually changed. Don't commit unchanged files.

### Step 7: Report to user

Output a concise summary:

```
Session wrapup complete:
- CURRENT-STATE.md: [what changed]
- ARCHITECTURE.md: [updated / no changes]
- CLI-REFERENCE.md: [updated / no changes]
- decision-log.md: [N new entries / no new entries]
- [any warnings: undocumented decisions, stale data, etc.]
```

## What NOT to do

- Don't rewrite documents from scratch — update incrementally
- Don't add speculative content ("we might add X later")
- Don't update core/agent-charter.md or core/agent-permissions.md (constitutional, Sprint 0 only)
- Don't fabricate metrics — use actual data or mark as "not measured"
- Don't update README.md in every wrapup — only when major milestones hit
