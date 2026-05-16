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
