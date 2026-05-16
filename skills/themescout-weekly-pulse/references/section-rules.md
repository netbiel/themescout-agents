# Section Classification Rules

Borderline cases for classifying items into pulse sections. Consult when uncertain.

## "Needs your action" vs "What I'd do autonomously"

| Situation | Section |
|---|---|
| Draft is ready, waiting for Piotr's review/edit/post | Needs your action |
| Agent has identified an opportunity but no draft yet, AND it's within agent's scope | Next week plan |
| Agent has identified an opportunity but it requires a decision outside scope (e.g., new profile category) | What I'd do autonomously |
| Pipeline error blocking module operation | Needs your action (always) |
| Cost zone hit orange or red | Needs your action (always) |

## "In progress" vs "Next week plan"

| Situation | Section |
|---|---|
| Started this week, not yet complete | In progress |
| Carried over from prior week, still open | In progress |
| Committed to but not yet started | Next week plan |
| Idea / hypothesis without commitment | Notable observations |

## "Notable observations" — what qualifies

Include only if:
- A genuine pattern across ≥2 data points (not single anomaly)
- An external event with potential project impact (Google update, competitor move, platform change)
- A meta-observation about the agent's own behavior worth flagging (e.g., "Drafted 4 Reddit replies this week, only 1 approved — recalibrating quality bar")

Do not include:
- Single data points without context
- Restating metrics from the metrics table
- Speculation without grounding

## When agent should NOT report something

The charter requires mandatory reporting of:
- Pipeline errors
- Schema validation failures
- Metric drops >10% week-over-week
- Cost spikes
- Actions that contradict prior decision-log entries

Outside of those: use judgment. If reporting something would create noise (e.g., a routine cache refresh), skip it. If unsure, lean toward including — Piotr's monthly retro will tell you if the pulse is too noisy or too sparse.

## When the data is missing or conflicting

- **Missing data file:** mark relevant metric as `n/a`, note in observations section: *"Could not load X this week — see decision-log entry [date]"*
- **Conflicting data sources** (e.g., GA4 and GSC disagree on traffic direction): show both, do not pick one. Add a `BLOCKED` entry to decision-log so you can investigate before next pulse.
- **Stale cache:** if cache is >48h old, mark metric as `stale (cached YYYY-MM-DD)` rather than presenting as current.
