# Release Notes — v0.1.0-rc1

## Summary
This release candidate locks a stable baseline and applies a targeted security hardening update.

## What changed
- Frozen baseline commit created before security work (`83f680b`).
- Upgraded `fastify` to `^5.8.2` in both frontend and API packages.
- Regenerated lockfiles with no schema/API contract changes.

## Validation
- `npm audit --omit=dev` (frontend): 0 vulnerabilities
- `npm audit --omit=dev` (API): 0 vulnerabilities
- Frontend gates: `build`, `test`, `lint`, `typecheck` all pass
- API gates: `build`, `test`, `lint`, `typecheck` all pass
- Focused smoke:
  - API `/health` returns 200
  - API `/jobs/search` returns 200 for valid payload and 400 for invalid payload
  - Frontend preview root returns 200

## Risk
- Low. Dependency patch only (`fastify` minor update) with full regression checks.

## Rollback
- Rollback tag: `rollback-pre-fastify-patch-20260310`
- Rollback commit: `83f680b`
