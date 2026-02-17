# Commons Jobs MVP

Public job board MVP with moderation, admin controls, and anti-abuse protections.

## Stack and Constraints
- Frontend: React 18 + TypeScript + Vite
- Backend: Fastify + TypeScript + Zod (served as a Vercel serverless function via `/api/*`)
- Storage: Supabase recommended for deployment (`STORAGE_PROVIDER=supabase`)
- Auth: Admin username + bcrypt password hash + signed bearer token
- Package manager: `npm`
- CI: GitHub Actions (`lint`, `typecheck`, `test`, `build`)

## Project Layout
- `/Users/tarique/Documents/commons-jobs` - frontend app
- `/Users/tarique/Documents/commons-jobs/api` - backend domain logic and tests
- `/Users/tarique/Documents/commons-jobs/vercel-api.ts` - Vercel serverless entrypoint

## Prerequisites
- Node.js 20+ (22 recommended)
- npm 10+

## Environment Setup

### Frontend
```bash
cd /Users/tarique/Documents/commons-jobs
cp .env.example .env.local
```
Notes:
- `VITE_API_BASE_URL` now defaults to `/api`.
- In local dev, Vite proxies `/api` to `http://127.0.0.1:4010` (configured in `/Users/tarique/Documents/commons-jobs/vite.config.ts`).
- Set `VITE_API_BASE_URL` explicitly only when frontend and API are on different domains in production.

### API
```bash
cd /Users/tarique/Documents/commons-jobs/api
cp .env.example .env
```

Storage options:
- `STORAGE_PROVIDER=file` (default): local JSON files under `api/data`
- `STORAGE_PROVIDER=supabase`: use Supabase tables for jobs and click analytics

For Supabase storage, set:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JOBS_TABLE` (default: `job_board_jobs`)
- `SUPABASE_CLICKS_TABLE` (default: `job_board_clicks`)

Then run this SQL in Supabase SQL Editor:
- `/Users/tarique/Documents/commons-jobs/api/supabase/migrations/20260216_job_board_storage.sql`

Generate admin password hash:
```bash
cd /Users/tarique/Documents/commons-jobs/api
node --input-type=module -e "import bcrypt from 'bcryptjs'; const hash = await bcrypt.hash(process.argv[1], 12); console.log(hash);" "ReplaceWithStrongPassword"
```

Paste output into `ADMIN_PASSWORD_HASH` in `.env`.

Important:
- In non-test mode, API fails fast at boot if `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, or `ADMIN_TOKEN_SECRET` are missing/weak.
- `ADMIN_TOKEN_SECRET` must be at least 32 chars.
- `TRUST_PROXY=false` is the safe default. If deployed behind one trusted reverse proxy, set `TRUST_PROXY=1`.
- If `STORAGE_PROVIDER=supabase`, API fails fast unless `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set.
- Production mode rejects `STORAGE_PROVIDER=file` to prevent ephemeral data loss.
- On Vercel, set `STORAGE_PROVIDER=supabase` (file storage is ephemeral on serverless).

## Install
Frontend:
```bash
cd /Users/tarique/Documents/commons-jobs
npm install
```

API:
```bash
cd /Users/tarique/Documents/commons-jobs/api
npm install
```

## Run in Development
API:
```bash
cd /Users/tarique/Documents/commons-jobs/api
npm run dev
```

Frontend (separate terminal):
```bash
cd /Users/tarique/Documents/commons-jobs
npm run dev
```

URLs:
- Frontend: `http://localhost:3000`
- API health: `http://localhost:4010/health`
- Frontend proxied API health: `http://localhost:3000/api/health`

## Quality Checks
Frontend:
```bash
cd /Users/tarique/Documents/commons-jobs
npm run lint
npm run typecheck
npm run test
npm run build
```

API:
```bash
cd /Users/tarique/Documents/commons-jobs/api
npm run lint
npm run typecheck
npm run test
npm run build
```

## Production Build (Local)
```bash
cd /Users/tarique/Documents/commons-jobs
npm run build
```
Output directory: `/Users/tarique/Documents/commons-jobs/dist`

## Deploy (Vercel-Only + Supabase)
1. In Supabase SQL Editor, run:
   - `/Users/tarique/Documents/commons-jobs/api/supabase/migrations/20260216_job_board_storage.sql`
2. In Vercel, import the repo and set Root Directory to:
   - `commons-jobs`
3. Build settings:
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Add Vercel environment variables:
   - `STORAGE_PROVIDER=supabase`
   - `SUPABASE_URL=https://<your-project>.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY=<service-role-key>`
   - `SUPABASE_JOBS_TABLE=job_board_jobs`
   - `SUPABASE_CLICKS_TABLE=job_board_clicks`
   - `ADMIN_USERNAME=<admin-username>`
   - `ADMIN_PASSWORD_HASH=<bcrypt-hash>`
   - `ADMIN_TOKEN_SECRET=<at-least-32-char-secret>`
   - `CLIENT_ORIGIN=https://<your-vercel-domain>.vercel.app`
   - `TRUST_PROXY=1`
5. Optional frontend env:
   - `VITE_API_BASE_URL=/api` (default already uses `/api`)
6. Deploy and verify API health:
   - `GET https://<your-vercel-domain>.vercel.app/api/health`

## Post-Deploy Smoke Test Checklist
1. Browse page loads and returns jobs.
2. Submit form rejects invalid payload and accepts valid payload.
3. Admin login works with configured username/password.
4. Pending submission appears in admin dashboard.
5. Approve submission; approved job appears in public listing.
6. Job detail modal opens; Escape closes modal.
7. Apply action opens external link in new tab.
8. Active job clicks increment; non-active job clicks return not found.
9. `/api/health` returns `{ ok: true }`.

## Security Notes
- No default secrets or credentials in runtime config.
- Backend enforces server-side validation/sanitization.
- Public submission/login/click endpoints are rate limited.
- Rate limiting uses `request.ip`; app never reads raw `x-forwarded-for`.
- CORS allow-list comes from `CLIENT_ORIGIN`.
