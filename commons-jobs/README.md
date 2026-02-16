# Commons Jobs MVP

Public job board MVP with moderation, admin controls, and anti-abuse protections.

## Stack and Constraints
- Frontend: React 18 + TypeScript + Vite
- Backend: Fastify + TypeScript + Zod
- Storage: File-backed JSON (`api/data/jobs.json` + `api/data/clicks.json`)
- Auth: Admin username + bcrypt password hash + signed bearer token
- Package manager: `npm`
- CI: GitHub Actions (`lint`, `typecheck`, `test`, `build`)

## Project Layout
- `/Users/tarique/Documents/commons-jobs` - frontend app
- `/Users/tarique/Documents/commons-jobs/api` - backend API

## Prerequisites
- Node.js 20+ (22 recommended)
- npm 10+

## Environment Setup

### Frontend
```bash
cd /Users/tarique/Documents/commons-jobs
cp .env.example .env.local
```

### API
```bash
cd /Users/tarique/Documents/commons-jobs/api
cp .env.example .env
```

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

## Production Start
API:
```bash
cd /Users/tarique/Documents/commons-jobs/api
npm run build
npm run start
```

Frontend static build:
```bash
cd /Users/tarique/Documents/commons-jobs
npm run build
```
Output directory: `/Users/tarique/Documents/commons-jobs/dist`

## Deploy (Low-Cost Path)
1. Deploy API first (Render/Railway/Fly/VM).
2. Set API environment variables from `/Users/tarique/Documents/commons-jobs/api/.env.example`.
3. Confirm API health endpoint:
   - `GET https://<api-domain>/health`
4. Deploy frontend to Netlify/Vercel:
   - build command: `npm run build`
   - publish directory: `dist`
5. Set frontend env:
   - `VITE_API_BASE_URL=https://<api-domain>`
6. Redeploy frontend.

## Post-Deploy Smoke Test Checklist
1. Browse page loads and returns jobs.
2. Submit form rejects invalid payload and accepts valid payload.
3. Admin login works with configured username/password.
4. Pending submission appears in admin dashboard.
5. Approve submission; approved job appears in public listing.
6. Job detail modal opens; Escape closes modal.
7. Apply action opens external link in new tab.
8. Active job clicks increment; non-active job clicks return not found.
9. `/health` returns `{ ok: true }`.

## Security Notes
- No default secrets or credentials in runtime config.
- Backend enforces server-side validation/sanitization.
- Public submission/login/click endpoints are rate limited.
- Rate limiting uses `request.ip`; app never reads raw `x-forwarded-for`.
- CORS allow-list comes from `CLIENT_ORIGIN`.
