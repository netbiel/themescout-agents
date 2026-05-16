# Dashboard

Local static SPA for ThemeScout Agent reporting and approvals.

## Status

Placeholder only (Sprint 0). Full build in Sprint 2.

## Planned architecture (Sprint 2)

- Static HTML/JS or Vite + React (decided at Sprint 2 kickoff)
- Reads JSON from `../data/` and Markdown from `../reports/`
- No backend — served via `python -m http.server 8000` from this folder
- No auth (localhost only)

## Future (Sprint 5+, if needed)

- Upgrade to FastAPI backend if interactive approvals from the dashboard become important
