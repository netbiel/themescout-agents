# Google Sheet Column Reference (v3.20.3)

Each row = one theme. Columns:

| Col | Index | Name | Content | Source |
|---|---|---|---|---|
| A | 1 | THEME_NAME | Theme name (e.g. "Neve") | Manual entry |
| B | 2 | SCRAPED_JSON | JSON from scraper: marketplace_data, pagespeed_data, distribution_model | External scraper + manual |
| C | 3 | PERPLEXITY | Raw research text from Perplexity | Perplexity API |
| D | 4 | STEP1_OUTPUT | Step 1 output: pain points, praise, sources index (Markdown tables) | Gemini |
| E | 5 | STEP2_OUTPUT | Step 2 output: verdicts, handoff, perf, plugin compat | Gemini |
| F | 6 | STEP3_OUTPUT | Final JSON after cleanup (~80 fields) | Gemini + cleanupOutput() |
| G | 7 | STATUS | Pipeline run status | Auto |
| H | 8 | OUTPUT_LINK | Google Drive link to JSON file | Auto |
| I | 9 | DEBUG_RAW | Raw JSON from Gemini before cleanup | Auto |
| J | 10 | TAXONOMY | JSON with WP term IDs (output of assignTaxonomies) | Auto |
| K | 11 | CHANGELOG | Changelog text (last 6 months) | Manual |
| L | 12 | WP_POST_ID | WP post ID for theme-profile | Mixed (manual paste or fetchPostIDs) |
