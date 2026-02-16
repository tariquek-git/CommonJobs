# Commons Jobs MVP Rebuild Plan (Preserve Look and Feel)

## 1) Current State (What you have)

The current codebase is a strong UI prototype, not production-ready MVP:

- Frontend stack: Vite + React + TypeScript with Tailwind CDN classes.
- Data layer: local constants + `localStorage` only (`/Users/tarique/Documents/commons-jobs/services/jobService.ts`).
- Admin auth: hardcoded password (`admin123`) in frontend code.
- AI integration: client-side Gemini calls and API key injection via Vite define.
- Aggregated feed: mock Canadian jobs from constants, not a real ingestion pipeline.
- Build blocker: `@google/genai@0.1.1` no longer resolves from npm (`npm install` fails).

## 2) MVP Definition (Rebuild target)

Rebuild as a real MVP while preserving visual/UI behavior from existing components:

- Keep component hierarchy and styles from:
  - `/Users/tarique/Documents/commons-jobs/App.tsx`
  - `/Users/tarique/Documents/commons-jobs/components/*.tsx`
- Replace mock/local state with real API + database.
- Replace frontend-only admin login with secure server auth.
- Move AI calls and key handling server-side.
- Keep current flows:
  - Browse + filters + search
  - Job detail modal
  - Submit job form + moderation queue
  - Admin dashboard actions
  - Direct vs Aggregated feed toggle

## 3) Recommended MVP Architecture

- Frontend: React (can stay Vite for speed).
- Backend: Node + TypeScript API (Fastify or Express).
- Database: PostgreSQL.
- ORM: Prisma.
- Auth: email magic-link or password login with secure session cookies.
- Queue/cron: scheduled job for aggregated feed ingestion.
- Hosting:
  - Frontend: Vercel/Netlify
  - API + worker: Render/Fly/Railway
  - DB: managed Postgres (Neon/Supabase/Render)

## 4) Data Model (minimum)

Core tables:

- `jobs`
  - id, role_title, company_name, company_website, external_link
  - source_type (`direct` | `aggregated`)
  - status (`pending` | `active` | `rejected` | `archived`)
  - location_city, location_state, location_country, remote_policy
  - employment_type, seniority, salary_range, currency
  - intelligence_summary, external_source, posted_date
  - created_at, updated_at
- `job_tags`
- `job_submissions`
  - submitter_name, submitter_email, raw_jd_text
- `admins`
- `audit_logs`
- `job_click_events` (or rollup counter)

## 5) API Surface (MVP)

- `GET /jobs` (public, filters + feed type)
- `GET /jobs/:id` (public)
- `POST /jobs/submissions` (public)
- `POST /jobs/:id/click` (public)
- `POST /auth/login` + `POST /auth/logout` (admin)
- `GET /admin/jobs` (admin)
- `PATCH /admin/jobs/:id/status` (admin)
- `PATCH /admin/jobs/:id` (admin)

## 6) Keep Look-and-Feel Strategy

UI lock rules:

- Do not redesign components.
- Keep existing class names and spacing scale where possible.
- Keep same copy, labels, and navigation flow.
- Port existing components first, then connect APIs behind them.

Implementation approach:

- Create `apiClient` and replace service calls in:
  - `/Users/tarique/Documents/commons-jobs/services/jobService.ts`
  - `/Users/tarique/Documents/commons-jobs/services/geminiService.ts`
- Keep component props unchanged to avoid visual/UX drift.

## 7) Priority Backlog

### Phase 0 - Stabilize (Day 1)

- Fix dependency versions and lockfile.
- Remove AI Studio-specific HTML artifacts in `/Users/tarique/Documents/commons-jobs/index.html`:
  - duplicate module scripts
  - importmap dependency loading
  - browser `window.process` polyfill hack
- Add lint, format, and build CI.

### Phase 1 - Backend foundation (Days 2-4)

- Stand up API service + Postgres + Prisma migrations.
- Implement jobs/submissions/admin schema and CRUD.
- Add auth + protected admin routes.
- Add validation (zod) and rate limiting.

### Phase 2 - Frontend integration (Days 5-6)

- Swap mock services to API calls.
- Preserve current UI states and animation behavior.
- Add optimistic updates only where already implied.
- Add error/empty/loading states parity.

### Phase 3 - Aggregated feed + AI hardening (Days 7-8)

- Move AI parsing/summary to backend endpoint.
- Add daily ingestion job for Canada feed (14-day window).
- Log ingestion failures and deduplicate by external URL.

### Phase 4 - Release readiness (Day 9)

- Seed initial jobs.
- Smoke test with production env.
- Add privacy/terms copy wiring to real support email.
- Ship MVP.

## 8) Known Risks to Address Early

- Security risk: current frontend-exposed admin auth and API key handling.
- Reliability risk: client-only persistence and random IDs.
- Product risk: "aggregated" feed is currently static mocks.
- Build risk: package versions are stale and currently broken.

## 9) Acceptance Criteria for MVP

- Public users can browse, filter, open detail modal, and click through.
- Public users can submit jobs to moderation queue.
- Admin can securely log in and moderate submissions.
- Aggregated feed refreshes automatically at least daily.
- Data persists across sessions and devices.
- No visual regression from current look and feel.
