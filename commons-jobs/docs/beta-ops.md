# Commons Jobs Beta Ops Runbook

This runbook is for the Stability + Trust beta window.

## Environment and Access
- Domain: `https://fintechcommons.com`
- Runtime target: `STORAGE_PROVIDER=supabase`
- Required runtime checks:
  - `/api/health` returns `{ "ok": true }`
  - `/api/admin/runtime` shows:
    - `provider: "supabase"`
    - `gemini.enabled: true`
    - `storageProbe.ok: true`

## Twice-Daily Reliability Checks

Run these from `/Users/tarique/Documents/commons-jobs`.

1) Production smoke flow:
```bash
ADMIN_USERNAME="..." ADMIN_PASSWORD="..." npm run ops:smoke
```

2) AI reliability monitor:
```bash
npm run ops:ai-monitor
```

Default AI monitor settings:
- `AI_MONITOR_SAMPLES=20` per endpoint
- `AI_FALLBACK_THRESHOLD=0.2`
- `AI_ALLOWED_5XX=0`
- `AI_RATE_LIMIT_MAX=30`
- `AI_RATE_LIMIT_WINDOW_MS=900000`

Override examples:
```bash
AI_MONITOR_SAMPLES=10 npm run ops:ai-monitor
AI_FALLBACK_THRESHOLD=0.1 npm run ops:ai-monitor
BASE_URL="https://common-jobs.vercel.app" npm run ops:ai-monitor
```

## Severity and Triage Rules
- `P0`: any 500/timeout impacting browse, submit, or admin login.
- `P1`: elevated AI fallback rate, response-time spikes, UX regressions.
- `P2`: cosmetic or low-impact polish.

Escalation thresholds:
- Any `/api/ai/*` 5xx in monitoring output: treat as `P0`.
- AI fallback rate >20% for a run: treat as `P1`.

## Daily Moderation Loop (10 min)
1. Admin Dashboard -> filter `pending`.
2. Approve valid jobs; reject/archive spam or low quality.
3. Normalize title/company/location for approved jobs.
4. Spot-check public board visibility after approvals.

## Feed Hygiene Utilities
Run from `/Users/tarique/Documents/commons-jobs`.

Archive visible QA artifacts:
```bash
ADMIN_USERNAME="..." ADMIN_PASSWORD="..." npm run ops:archive-test-jobs
```

Reseed Web Pulse from live internet sources (Canada, <=12 days, cap 5/company):
```bash
ADMIN_USERNAME="..." ADMIN_PASSWORD="..." npm run ops:reseed-aggregated
```

## Launch Gate (48h)
Only expand beta tester volume when all conditions pass for 48h:
- No `P0` incidents.
- AI monitor shows zero unhandled 5xx.
- Smoke flow passes end-to-end each run.
