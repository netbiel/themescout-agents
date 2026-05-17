# ThemeScout Agent

A modular AI agent system for running ThemeScout (themescout.pro) with human-in-the-loop.

## Hypothesis

Does a regularly-running agent team with human-in-the-loop outperform a human who only occasionally updates and verifies the site?

## Status

Pipeline migration complete (Sprint 6). Python pipeline replaces Apps Script v3.20.3 as primary path. Parity: 92.4% on 10 benchmark themes.

## Architecture

- **Theme Collector** (`modules/theme_collector/`) -- 3-step Gemini pipeline + cleanup + WP import
- **Stats Analyzer** (`modules/stats_analyzer/`) -- GA4 + Clarity metrics
- **Research** (`modules/research/`) -- Reddit monitoring via public RSS
- **Dashboard** (`dashboard/`) -- local web UI for metrics
- **Validation** -- 3-layer: L1 automatic, L2 Claude editorial, L3 WordPress human

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for full system design.

## Documentation

| Document | Purpose |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System design, modules, data flow |
| [`docs/CURRENT-STATE.md`](docs/CURRENT-STATE.md) | Sprint status, metrics, open blockers |
| [`docs/CLI-REFERENCE.md`](docs/CLI-REFERENCE.md) | All CLI commands with examples |
| [`docs/wp-integration.md`](docs/wp-integration.md) | WordPress REST API endpoints |
| [`core/agent-charter.md`](core/agent-charter.md) | Mission, scope, success criteria |
| [`core/agent-permissions.md`](core/agent-permissions.md) | What the agent can/cannot do |
| [`core/cost-guardrails.md`](core/cost-guardrails.md) | Cost zones and budgets |
| [`core/decision-log.md`](core/decision-log.md) | All decisions (append-only) |

## Quick start

```bash
# 1. Setup
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt

# 2. Secrets (in ../.secret/, not in repo)
# gemini_api_key.txt, wp_credentials.txt, client_secret_*.json

# 3. Run pipeline on a theme
python -m modules.theme_collector.cli run neve --inputs data/parity-benchmarks/neve/inputs.json

# 4. Validate output
python -m modules.theme_collector.cli validate neve

# 5. Import to WordPress (dry run)
python -m modules.theme_collector.cli import neve

# 6. Dashboard
python serve.py --port 8080
```

## Sprint plan

- [x] Sprint 0: Foundation
- [x] Sprint 1: Stats Analyzer (GA4 + Clarity)
- [x] Sprint 2: Dashboard MVP
- [x] Sprint 3: Research (Reddit RSS)
- [x] Sprint 4-6: Pipeline migration + WP integration + validation
- [ ] Sprint 7: Local LLM integration (Qwen 2.5 14B)
- [ ] Sprint 8: Orchestration + scheduler
