# ThemeScout Agent -- Architecture

**Last updated:** 2026-05-17
**Version:** Post Sprint 6 + Validator/PSI patch

---

## System Overview

```
                    +------------------+
                    |    Piotr (human)  |
                    +--------+---------+
                             |
                    triggers / reviews
                             |
                    +--------v---------+
                    |   Claude Code    |  <-- reasoning, drafting, L2 review
                    |   (interactive)  |
                    +--------+---------+
                             |
              +--------------+--------------+
              |              |              |
     +--------v---+  +------v------+  +----v--------+
     |   Theme    |  |   Stats     |  |  Research   |
     | Collector  |  |  Analyzer   |  |  (Reddit)   |
     +--------+---+  +------+------+  +----+--------+
              |              |              |
              v              v              v
         +----+----+   +----+----+   +-----+-----+
         |WordPress|   |  GA4 /  |   |  Reddit   |
         |REST API |   | Clarity |   | RSS feeds |
         +---------+   +---------+   +-----------+
```

## Modules

### theme_collector (`modules/theme_collector/`)
**Purpose:** 3-step pipeline replacing Apps Script v3.20.3. Generates theme profile JSON for WordPress import.

**Pre-pipeline (candidate validation):**
```
candidates input JSON -> validator.py (URL checks + PSI test) -> validated JSON
                         -> psi_fetcher.py (3+3 runs, median) -> base JSON with pagespeed_data
```

**Full pipeline:**
```
theme_collector/
  validator.py           # pre-pipeline: URL reachability + PSI test (gate for psi_fetcher)
  psi_fetcher.py         # pre-pipeline: 3 mobile + 3 desktop PSI runs, median metrics
  pipeline/
    orchestrator.py      # full pipeline: step1 -> step2 -> step3 -> cleanup -> taxonomies -> search_profile -> L1
    step1_community.py   # Gemini: community pain points + praise extraction
    step2_verdict.py     # Gemini: verdict synthesis (handoff, perf, updates, plugins)
    step3_json.py        # Gemini: structured JSON output (~80 fields)
    cleanup.py           # Pure Python: 16 transformations (stale detection, fallback praise, etc.)
    taxonomies.py        # Pure Python: 8 WP taxonomy mappers
    search_profile.py    # Pure Python: pipe-delimited search string for PHP scorer
    gemini_client.py     # Gemini API wrapper with retry + cost logging
  wp/
    client.py            # WordPress REST API (Basic auth)
    post_id_resolver.py  # theme name -> WP post ID (cached)
    importer.py          # POST /wpagent/v1/theme-profile/import (dry-run default)
  validation/
    l1_structural.py     # Automatic structural validation (6 rule modules)
    l2_review.py         # Generates L2 artifact for Claude Code session
    l2_apply.py          # Auto-merges high-confidence L2 verdicts
    rules/               # L1 rule modules: completeness, cross_field, source_refs, search_profile, plugin_compat, score_derivation
    parity.py            # Step 1 parity check (Python vs Apps Script)
  prompts/               # Extracted from Apps Script: step1, step2, step3, json_schema
  cli.py                 # Click CLI: run, step1, validate, review, apply-l2, import, full-run
```

**Data flow:**
```
inputs.json (theme_name, scraped_json, perplexity_text)
  -> Step 1 (Gemini) -> Markdown: pain points, praise, sources
  -> Step 2 (Gemini) -> Markdown: verdicts, plugin compat, FAQ
  -> Step 3 (Gemini) -> Raw JSON (~80 fields)
  -> cleanup_output() -> Cleaned JSON (stale detection, fallbacks, fixes)
  -> assign_taxonomies() -> WP term IDs
  -> generate_search_profile() -> Pipe-delimited string
  -> L1 validation -> Issues JSON (blocks import on errors)
  -> WP import (dry-run default)
```

**Cost:** ~$0.19/theme (3 Gemini 2.5 Pro calls)

### stats_analyzer (`modules/stats_analyzer/`)
**Purpose:** GA4 + Clarity data for weekly pulse metrics.

- `auth.py` -- OAuth 2.0 flow for GA4 (token cached in .secret/)
- `ga4.py` -- Weekly overview, traffic sources, LLM referrals
- `clarity.py` -- Clarity Data Export API (returns 500 with low traffic)
- `export_baseline.py` -- Exports GA4 snapshots to data/baseline/
- `cli.py` -- verify, weekly, sources, llm, clarity-test

### research (`modules/research/`)
**Purpose:** Reddit monitoring via public JSON feeds (no API key needed).

- `reddit_rss.py` -- Scans subreddits from config, keyword matching, relevance scoring
- `cli.py` -- scan command

## Validation System (3 layers)

| Layer | Where | Trigger | Blocks import? |
|---|---|---|---|
| **L1 Structural** | Python (automatic) | After every cleanup | Yes (on errors) |
| **L2 Editorial** | Claude Code session | Manual: `review <theme>` | No (flags for L3) |
| **L3 Human** | WordPress Verify Dashboard | Manual in WP Admin | Yes (manual overrides) |

## Configuration

| File | Purpose |
|---|---|
| `config/target_themes.yaml` | Theme catalog (44 published + 6 expansion) |
| `config/reddit_subreddits.yaml` | Monitored subreddits + keywords |
| `config/taxonomy_mappings.yaml` | WP term IDs for 8 taxonomies |
| `config/secrets.env.example` | Template for API keys |

## Secrets (NOT in repo)

All in `../.secret/` (parent directory, gitignored):

| File | Content |
|---|---|
| `client_secret_*.json` | Google OAuth client |
| `ga4_token.json` | GA4 OAuth token (auto-refreshed) |
| `clarity_token.txt` | Clarity API JWT |
| `gemini_api_key.txt` | Gemini Pro API key |
| `wp_credentials.txt` | WordPress app password |

## Data Directory

```
data/
  baseline/          # GA4 weekly snapshots (gitignored: raw/)
  cache/             # Pipeline outputs (all gitignored)
    step1/           # Step 1 markdown per theme
    step2/           # Step 2 markdown per theme
    step3-raw/       # Step 3 raw JSON per theme
    final/           # Cleaned + enriched JSON per theme
    validation/      # L1 results per theme
    reddit/          # Reddit scan results
    wp-post-ids.json # Cached theme -> post_id mapping
  parity-benchmarks/ # 10 benchmark themes (inputs + Apps Script reference + Python output)
  pending-review/    # L2 review artifacts (gitignored)
  l2-verdicts/       # L2 Claude verdicts (gitignored)
```

## External Dependencies

| Service | Auth | Permission | Used by |
|---|---|---|---|
| Gemini 2.5 Pro | API key | Read/write (LLM calls) | theme_collector pipeline |
| Google Analytics 4 | OAuth 2.0 | Read only | stats_analyzer |
| Microsoft Clarity | JWT token | Read only (10 calls/day) | stats_analyzer |
| WordPress REST | App password | Write: drafts only | theme_collector importer |
| Reddit | None (public RSS) | Read only | research |

## Decision Principles

1. **Piotr's instruction > charter > permissions > cost guardrails > decision log**
2. **Decision log is append-only** -- reversals create new entries
3. **WordPress writes = drafts/dry-run by default** -- explicit flag for actual write
4. **L1 validation blocks import on errors** -- override with --skip-validation
5. **Apps Script stays as fallback** -- not modified, same WP endpoint
6. **Cost green zone < $5/week** -- logged per LLM call to data/llm-calls.log
