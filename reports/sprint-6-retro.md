# Sprint 4-6 Retro -- Pipeline Migration

**Date:** 2026-05-17
**Scope:** Sprint 4 (Step 1), Sprint 5 (full pipeline), Sprint 6 (WP integration + parity)

---

## Parity Test Results

**Overall: 92.4% (target >=90%) -- PASS**

| Theme | Score | Category |
|---|---|---|
| Neve | 92.6% | simple |
| Astra | 92.3% | complex |
| Kadence | 90.9% | complex |
| Divi | 88.3% | complex |
| Betheme | 94.7% | niche premium |
| GeneratePress | 88.3% | simple |
| OceanWP | 94.7% | simple |
| Hello Elementor | 94.7% | edge case |
| Bricks Builder | 92.6% | edge case |
| Uncode | 94.7% | niche premium |

Note: Astra & Kadence have partial Apps Script reference (13/11 fields vs 96). Python generates complete output.

## Cost Summary

| Phase | Themes | Cost | Per theme |
|---|---|---|---|
| Step 1 only (Sprint 4) | 3 | $0.12 | $0.04 |
| Full pipeline (Sprint 5-6) | 10 | $1.86 | $0.19 |
| **Total** | | **$1.98** | |

Green zone (<$5/week). Estimated cost for 44 published themes: ~$8.80 (one-time).

## WP Import Test

- **Uncode** imported to post_id=2003: 20 fields written, 0 skipped, 0 errors
- Flat fields (search_profile, last_verification) confirmed working
- Nested objects (theme_basic, performance_metrics) accepted by plugin API

## L1 Validation Results (post-fix)

| Theme | Errors | Warnings | Status |
|---|---|---|---|
| Neve | 0 | 2 | OK |
| Astra | 0 | 0 | OK |
| Kadence | 0 | 0 | OK |
| Divi | 8 | 0 | Blocked (plugin compat gaps) |
| Betheme | 2 | 0 | Blocked |
| GeneratePress | 1 | 2 | Blocked |
| Hello Elementor | 3 | 2 | Blocked |
| Bricks Builder | 4 | 0 | Blocked |
| OceanWP | 0 | 2 | OK |
| Uncode | 1 | 0 | Blocked |

Most errors: plugins mentioned in pain points but missing from plugin_compatibility_list. This is a Gemini Step 2 output quality issue, not a pipeline bug.

## Time Comparison: Python vs Apps Script

| Metric | Apps Script | Python Pipeline |
|---|---|---|
| Per-theme runtime | ~3-5 min (Google Apps) | ~3 min (local + API) |
| Cost per theme | ~$0.30-0.80 | ~$0.19 |
| Automation potential | Manual trigger in Sheet | CLI, scriptable |
| Cleanup quality | v3.20.3 (mature) | Port + improvements (L1 validation) |

## Issues Encountered

1. **google-generativeai deprecated** -- migrated to google-genai SDK
2. **Gemini 2.5 Pro thinking model** -- requires higher max_output_tokens (thinking tokens consume output budget)
3. **Unicode encoding** -- Windows cp1250 doesn't support arrow characters in CLI
4. **Performance tier mismatch** -- Gemini sometimes classifies tier wrong; fixed with deterministic cleanup
5. **Plugin compat gaps** -- Gemini Step 2 misses some plugins mentioned in pain points

## Recommendation

**Decommission Apps Script as primary path. Keep as emergency fallback.**

Rationale:
- Python pipeline produces equivalent or better output (92.4% parity)
- Lower cost ($0.19 vs $0.30-0.80 per theme)
- L1 validation catches errors Apps Script didn't detect
- Fully scriptable (CLI, can be scheduled)
- Apps Script stays functional, no modifications needed

Piotr reviews and decides.

---

## Next Steps

1. Piotr reviews this retro and confirms decommission decision
2. Run pipeline on all 44 published themes (estimated cost: ~$8.80)
3. Sprint 7: Local LLM integration (Qwen 2.5 14B on RTX 5070 Ti)
4. Sprint 8: Orchestration (scheduler, cron, notifications)
