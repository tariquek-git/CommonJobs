# Commons Jobs MVP

Community-first fintech job board with:
- Public browsing and filtering
- Community job submissions
- Admin moderation and editing
- Optional AI-assisted parsing/summaries

## Stack
- Frontend: React 18 + TypeScript + Vite
- Backend API: Fastify + TypeScript + Zod
- Storage (MVP default): JSON file (`api/data/jobs.json`)
- CI: GitHub Actions (`lint + typecheck + test + build`)
- Hosting assumption:
  - Frontend on Netlify/Vercel (static build)
  - API on any Node host (Render/Railway/Fly/VM)

## Project Structure
- `/Users/tarique/Documents/commons-jobs` - frontend app
- `/Users/tarique/Documents/commons-jobs/api` - backend API

## Prerequisites
- Node.js 20+ (Node 22 recommended)
- npm 10+

## Environment Variables

### Frontend (`/Users/tarique/Documents/commons-jobs/.env.local`)
```bash
VITE_API_BASE_URL=http://localhost:4010
```

### API (`/Users/tarique/Documents/commons-jobs/api/.env`)
Copy `/Users/tarique/Documents/commons-jobs/api/.env.example` and set values.

Required for production:
- `ADMIN_PASSWORD` must not use default value
- `ADMIN_TOKEN_SECRET` must not use default value

Optional:
- `GEMINI_API_KEY` only if you want AI parsing/summary endpoints enabled

## Run Locally

1. Install frontend deps:
```bash
cd /Users/tarique/Documents/commons-jobs
npm install
```

2. Install API deps:
```bash
cd /Users/tarique/Documents/commons-jobs/api
npm install
```

3. Start API:
```bash
cd /Users/tarique/Documents/commons-jobs/api
npm run dev
```

4. Start frontend (new terminal):
```bash
cd /Users/tarique/Documents/commons-jobs
npm run dev
```

5. Open:
- Frontend: `http://localhost:5173`
- API health: `http://localhost:4010/health`

## Test and Quality Commands

### Frontend
```bash
cd /Users/tarique/Documents/commons-jobs
npm run lint
npm run typecheck
npm run test
npm run build
```

### API
```bash
cd /Users/tarique/Documents/commons-jobs/api
npm run lint
npm run test
npm run build
```

## Production Build

Frontend:
```bash
cd /Users/tarique/Documents/commons-jobs
npm run build
```
Output: `/Users/tarique/Documents/commons-jobs/dist`

API:
```bash
cd /Users/tarique/Documents/commons-jobs/api
npm run build
npm run start
```

## Deploy (Simple Path)

1. Deploy API first and set API env vars.
2. Confirm API health route returns `200` at `/health`.
3. Deploy frontend using:
   - Build command: `npm run build`
   - Publish dir: `dist`
4. Set frontend env var:
   - `VITE_API_BASE_URL=https://<your-api-domain>`
5. Redeploy frontend.

## Smoke Test Checklist

1. Browse page loads and lists jobs.
2. Submit a new job from public form.
3. Admin login succeeds with configured password.
4. Admin sees pending submission and marks it `active`.
5. Activated job appears on public feed.
6. Job detail modal opens and apply button opens external URL.
7. `/health` returns OK in production.

## Security Notes
- Admin routes require bearer token from login endpoint.
- Public submission endpoint has rate limiting + honeypot field check.
- URL/text/tag inputs are sanitized server-side.
- API enforces non-default admin secrets in production.
