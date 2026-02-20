import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { JobPosting } from '../src/types/jobs.js';
import { InMemoryClickRepository } from '../src/storage/inMemoryClickRepository.js';
import { InMemoryJobRepository } from '../src/storage/inMemoryJobRepository.js';
import { _resetRateLimitForTests } from '../src/lib/rateLimit.js';
import { hashAdminPassword } from '../src/auth/adminPassword.js';
import { parseEnv } from '../src/config/env.js';

let adminPasswordHash = '';
class FailingClickRepository {
  async get() {
    throw new Error('click store unavailable');
  }
  async getMany() {
    throw new Error('click store unavailable');
  }
  async increment() {
    throw new Error('click store unavailable');
  }
}

const buildTestEnv = (overrides: Record<string, string> = {}) =>
  parseEnv({
    NODE_ENV: 'test',
    PORT: '4010',
    DATA_FILE: 'data/jobs.json',
    CLICK_DATA_FILE: 'data/clicks.json',
    CLIENT_ORIGIN: 'http://localhost:5173',
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD_HASH: adminPasswordHash,
    ADMIN_TOKEN_SECRET: '12345678901234567890123456789012',
    RATE_LIMIT_WINDOW_MS: '900000',
    RATE_LIMIT_MAX_SUBMIT: '20',
    RATE_LIMIT_MAX_ADMIN_LOGIN: '30',
    RATE_LIMIT_MAX_CLICK: '60',
    RATE_LIMIT_MAX_AI: '30',
    CLICK_DEDUPE_WINDOW_MS: '60000',
    TRUST_PROXY: 'false',
    ...overrides
  });

const getSessionCookie = (headers: Record<string, unknown>): string => {
  const setCookieHeader = headers['set-cookie'];
  const raw = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
  expect(typeof raw).toBe('string');
  return String(raw).split(';')[0];
};

describe('API integration', () => {
  beforeAll(async () => {
    adminPasswordHash = await hashAdminPassword('Tark101', 4);
  });

  beforeEach(() => {
    _resetRateLimitForTests();
  });

  it('submit -> approve -> visible -> click apply happy path', async () => {
    const repo = new InMemoryJobRepository([]);
    const app = buildApp(repo, new InMemoryClickRepository(), buildTestEnv());

    const submitRes = await app.inject({
      method: 'POST',
      url: '/jobs/submissions',
      payload: {
        companyName: 'Nova Labs',
        roleTitle: 'Risk Analyst',
        externalLink: 'https://example.com/job',
        locationCountry: 'Canada',
        locationCity: 'Toronto',
        submitterName: 'Admin',
        submitterEmail: 'admin@example.com'
      }
    });

    expect(submitRes.statusCode).toBe(201);
    const submitBody = submitRes.json() as { jobId: string };
    expect(submitBody.jobId).toBeTruthy();

    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/admin-login',
      payload: { username: 'admin', password: 'Tark101' }
    });
    expect(loginRes.statusCode).toBe(200);
    expect((loginRes.json() as { ok: boolean }).ok).toBe(true);
    const sessionCookie = getSessionCookie(loginRes.headers as Record<string, unknown>);

    const approveRes = await app.inject({
      method: 'PATCH',
      url: `/admin/jobs/${submitBody.jobId}/status`,
      headers: { cookie: sessionCookie },
      payload: { status: 'active' }
    });
    expect(approveRes.statusCode).toBe(200);

    const listRes = await app.inject({
      method: 'POST',
      url: '/jobs/search',
      payload: {
        feedType: 'direct',
        filters: {
          keyword: 'risk analyst',
          remotePolicies: [],
          seniorityLevels: [],
          employmentTypes: [],
          dateRange: 'all',
          locations: []
        }
      }
    });

    expect(listRes.statusCode).toBe(200);
    const listBody = listRes.json() as { jobs: Array<Record<string, unknown>> };
    const listedJob = listBody.jobs.find((job) => job.id === submitBody.jobId);
    expect(Boolean(listedJob)).toBe(true);
    expect(listedJob && 'submitterName' in listedJob).toBe(false);
    expect(listedJob && 'submitterEmail' in listedJob).toBe(false);

    const publicDetailRes = await app.inject({
      method: 'GET',
      url: `/jobs/${submitBody.jobId}`
    });
    expect(publicDetailRes.statusCode).toBe(200);
    const publicDetailJob = (publicDetailRes.json() as { job: Record<string, unknown> }).job;
    expect('submitterName' in publicDetailJob).toBe(false);
    expect('submitterEmail' in publicDetailJob).toBe(false);

    const adminDetailRes = await app.inject({
      method: 'GET',
      url: `/jobs/${submitBody.jobId}`,
      headers: { cookie: sessionCookie }
    });
    expect(adminDetailRes.statusCode).toBe(200);
    const adminDetailJob = (adminDetailRes.json() as { job: Record<string, unknown> }).job;
    expect(adminDetailJob.submitterName).toBe('Admin');
    expect(adminDetailJob.submitterEmail).toBe('admin@example.com');

    const clickRes = await app.inject({
      method: 'POST',
      url: `/jobs/${submitBody.jobId}/click`
    });
    expect(clickRes.statusCode).toBe(200);
    const clickBody = clickRes.json() as { clicks: number };
    expect(clickBody.clicks).toBe(1);

    await app.close();
  });

  it('AI endpoints return 503 when not configured', async () => {
    const app = buildApp(new InMemoryJobRepository([]), new InMemoryClickRepository(), buildTestEnv());

    const res = await app.inject({
      method: 'POST',
      url: '/ai/analyze-job',
      payload: { description: 'Test description' }
    });
    expect(res.statusCode).toBe(503);

    await app.close();
  });

  it('jobs search supports sort, pagination, and facets metadata', async () => {
    const app = buildApp(new InMemoryJobRepository(), new InMemoryClickRepository(), buildTestEnv());

    const res = await app.inject({
      method: 'POST',
      url: '/jobs/search',
      payload: {
        feedType: 'direct',
        sort: 'company_az',
        page: 1,
        pageSize: 1,
        filters: {
          keyword: '',
          remotePolicies: [],
          seniorityLevels: [],
          employmentTypes: [],
          dateRange: 'all',
          locations: []
        }
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      jobs: Array<{ companyName: string }>;
      total: number;
      page: number;
      pageSize: number;
      facets: { remotePolicies: Record<string, number> };
      meta: { companyCapApplied: boolean };
    };
    expect(body.total).toBeGreaterThanOrEqual(body.jobs.length);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(1);
    expect(body.facets.remotePolicies).toBeTruthy();
    expect(body.meta.companyCapApplied).toBe(false);

    await app.close();
  });

  it('jobs search enforces aggregated company diversity cap', async () => {
    const now = Date.now();
    const repeatedJobs: JobPosting[] = Array.from({ length: 7 }).map((_, index) => ({
      id: `agg-${index}`,
      companyName: 'RepeatCo',
      companyWebsite: 'https://repeat.co',
      roleTitle: `Aggregated Role ${index}`,
      externalLink: `https://repeat.co/jobs/${index}`,
      postedDate: new Date(now - index * 1_000).toISOString(),
      status: 'active',
      sourceType: 'Aggregated',
      isVerified: false,
      clicks: 0
    }));
    const uniqueJob: JobPosting = {
      id: 'agg-unique',
      companyName: 'UniqueCo',
      companyWebsite: 'https://unique.co',
      roleTitle: 'Unique Role',
      externalLink: 'https://unique.co/jobs/1',
      postedDate: new Date(now - 10_000).toISOString(),
      status: 'active',
      sourceType: 'Aggregated',
      isVerified: false,
      clicks: 0
    };

    const app = buildApp(new InMemoryJobRepository([...repeatedJobs, uniqueJob]), new InMemoryClickRepository(), buildTestEnv());

    const res = await app.inject({
      method: 'POST',
      url: '/jobs/search',
      payload: {
        feedType: 'aggregated',
        filters: {
          keyword: '',
          remotePolicies: [],
          seniorityLevels: [],
          employmentTypes: [],
          dateRange: 'all',
          locations: []
        }
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { jobs: JobPosting[]; total: number; meta: { companyCapApplied: boolean } };
    expect(body.meta.companyCapApplied).toBe(true);
    expect(body.total).toBe(6);
    expect(body.jobs.filter((job) => job.companyName === 'RepeatCo')).toHaveLength(5);
    expect(body.jobs.some((job) => job.companyName === 'UniqueCo')).toBe(true);

    await app.close();
  });

  it('AI endpoints are rate limited by request.ip and not bypassed by spoofed x-forwarded-for', async () => {
    const stubAi = {
      analyzeJobDescription: async () => ({ ok: true }),
      parseSearchQuery: async () => ({ ok: true })
    };
    const app = buildApp(
      new InMemoryJobRepository([]),
      new InMemoryClickRepository(),
      buildTestEnv({
        GEMINI_API_KEY: 'fake-key',
        RATE_LIMIT_MAX_AI: '1'
      }),
      stubAi as any
    );

    const first = await app.inject({
      method: 'POST',
      url: '/ai/analyze-job',
      payload: { description: 'Test description' }
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: 'POST',
      url: '/ai/analyze-job',
      headers: { 'x-forwarded-for': '8.8.8.8' },
      payload: { description: 'Test description' }
    });
    expect(second.statusCode).toBe(429);

    await app.close();
  });

  it('AI endpoints return heuristic fallback when Gemini call fails', async () => {
    const stubAi = {
      analyzeJobDescription: async () => null,
      parseSearchQuery: async () => null
    };
    const app = buildApp(
      new InMemoryJobRepository([]),
      new InMemoryClickRepository(),
      buildTestEnv({
        GEMINI_API_KEY: 'fake-key'
      }),
      stubAi as any
    );

    const res = await app.inject({
      method: 'POST',
      url: '/ai/analyze-job',
      payload: { description: 'Test description' }
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { result?: { summary?: string }; fallback?: boolean };
    expect(body.fallback).toBe(true);
    expect(typeof body.result?.summary).toBe('string');

    await app.close();
  });

  it('rejects admin endpoints without an authenticated session', async () => {
    const app = buildApp(new InMemoryJobRepository(), new InMemoryClickRepository(), buildTestEnv());
    const res = await app.inject({ method: 'GET', url: '/admin/jobs' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('returns runtime info for admins', async () => {
    const app = buildApp(new InMemoryJobRepository(), new InMemoryClickRepository(), buildTestEnv());

    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/admin-login',
      payload: { username: 'admin', password: 'Tark101' }
    });
    expect(loginRes.statusCode).toBe(200);
    expect((loginRes.json() as { ok: boolean }).ok).toBe(true);
    const sessionCookie = getSessionCookie(loginRes.headers as Record<string, unknown>);

    const res = await app.inject({
      method: 'GET',
      url: '/admin/runtime',
      headers: { cookie: sessionCookie }
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { ok: boolean; provider: string };
    expect(body.ok).toBe(true);
    expect(body.provider).toBe('file');
    await app.close();
  });

  it('admin partial update preserves company website when omitted from payload', async () => {
    const now = new Date().toISOString();
    const app = buildApp(
      new InMemoryJobRepository([
        {
          id: 'job-1',
          companyName: 'Acme',
          companyWebsite: 'https://acme.example',
          roleTitle: 'Analyst',
          externalLink: 'https://acme.example/jobs/analyst',
          postedDate: now,
          status: 'active',
          sourceType: 'Direct',
          isVerified: true,
          clicks: 0
        }
      ]),
      new InMemoryClickRepository(),
      buildTestEnv()
    );

    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/admin-login',
      payload: { username: 'admin', password: 'Tark101' }
    });
    expect(loginRes.statusCode).toBe(200);
    const sessionCookie = getSessionCookie(loginRes.headers as Record<string, unknown>);

    const patchRes = await app.inject({
      method: 'PATCH',
      url: '/admin/jobs/job-1',
      headers: { cookie: sessionCookie },
      payload: {
        roleTitle: 'Senior Analyst'
      }
    });

    expect(patchRes.statusCode).toBe(200);
    const body = patchRes.json() as { job: JobPosting };
    expect(body.job.roleTitle).toBe('Senior Analyst');
    expect(body.job.companyWebsite).toBe('https://acme.example');

    await app.close();
  });

  it('rejects wrong admin password', async () => {
    const app = buildApp(new InMemoryJobRepository(), new InMemoryClickRepository(), buildTestEnv());
    const res = await app.inject({
      method: 'POST',
      url: '/auth/admin-login',
      payload: { username: 'admin', password: 'wrong-password' }
    });

    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('sets and clears admin session cookies via login/logout endpoints', async () => {
    const app = buildApp(new InMemoryJobRepository(), new InMemoryClickRepository(), buildTestEnv());

    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/admin-login',
      payload: { username: 'admin', password: 'Tark101' }
    });
    expect(loginRes.statusCode).toBe(200);
    const loginCookie = getSessionCookie(loginRes.headers as Record<string, unknown>);
    expect(loginCookie.startsWith('commons_jobs_admin=')).toBe(true);

    const sessionRes = await app.inject({
      method: 'GET',
      url: '/auth/admin-session',
      headers: { cookie: loginCookie }
    });
    expect(sessionRes.statusCode).toBe(200);
    expect((sessionRes.json() as { authenticated: boolean }).authenticated).toBe(true);

    const logoutRes = await app.inject({
      method: 'POST',
      url: '/auth/admin-logout',
      headers: { cookie: loginCookie }
    });
    expect(logoutRes.statusCode).toBe(200);
    const clearedCookie = getSessionCookie(logoutRes.headers as Record<string, unknown>);
    expect(clearedCookie).toBe('commons_jobs_admin=');

    const sessionAfterLogoutRes = await app.inject({
      method: 'GET',
      url: '/auth/admin-session',
      headers: { cookie: clearedCookie }
    });
    expect(sessionAfterLogoutRes.statusCode).toBe(200);
    expect((sessionAfterLogoutRes.json() as { authenticated: boolean }).authenticated).toBe(false);

    await app.close();
  });

  it('rate limiting uses request.ip and is not bypassed by spoofed x-forwarded-for on login', async () => {
    const app = buildApp(
      new InMemoryJobRepository(),
      new InMemoryClickRepository(),
      buildTestEnv({
        RATE_LIMIT_MAX_ADMIN_LOGIN: '1'
      })
    );

    const first = await app.inject({
      method: 'POST',
      url: '/auth/admin-login',
      payload: { username: 'admin', password: 'wrong-password' }
    });
    expect(first.statusCode).toBe(401);

    const second = await app.inject({
      method: 'POST',
      url: '/auth/admin-login',
      headers: { 'x-forwarded-for': '8.8.8.8' },
      payload: { username: 'admin', password: 'wrong-password' }
    });
    expect(second.statusCode).toBe(429);

    await app.close();
  });

  it('stores moderation note and moderation timestamp on admin status updates', async () => {
    const now = new Date().toISOString();
    const app = buildApp(
      new InMemoryJobRepository([
        {
          id: 'job-moderation-1',
          companyName: 'Acme',
          companyWebsite: 'https://acme.example',
          roleTitle: 'Compliance Analyst',
          externalLink: 'https://acme.example/jobs/1',
          postedDate: now,
          status: 'pending',
          sourceType: 'Direct',
          isVerified: true,
          clicks: 0
        }
      ]),
      new InMemoryClickRepository(),
      buildTestEnv()
    );

    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/admin-login',
      payload: { username: 'admin', password: 'Tark101' }
    });
    const sessionCookie = getSessionCookie(loginRes.headers as Record<string, unknown>);

    const updateRes = await app.inject({
      method: 'PATCH',
      url: '/admin/jobs/job-moderation-1/status',
      headers: { cookie: sessionCookie },
      payload: {
        status: 'rejected',
        moderationNote: 'Missing required compensation details'
      }
    });
    expect(updateRes.statusCode).toBe(200);
    const updatedJob = (updateRes.json() as { job: JobPosting }).job;
    expect(updatedJob.status).toBe('rejected');
    expect(updatedJob.moderationNote).toBe('Missing required compensation details');
    expect(typeof updatedJob.moderatedAt).toBe('string');

    const adminListRes = await app.inject({
      method: 'GET',
      url: '/admin/jobs',
      headers: { cookie: sessionCookie }
    });
    expect(adminListRes.statusCode).toBe(200);
    const listed = (adminListRes.json() as { jobs: JobPosting[] }).jobs.find((job) => job.id === 'job-moderation-1');
    expect(listed?.moderationNote).toBe('Missing required compensation details');
    expect(typeof listed?.moderatedAt).toBe('string');

    await app.close();
  });

  it('rate limiting uses request.ip and is not bypassed by spoofed x-forwarded-for on submissions', async () => {
    const app = buildApp(
      new InMemoryJobRepository([]),
      new InMemoryClickRepository(),
      buildTestEnv({
        RATE_LIMIT_MAX_SUBMIT: '1'
      })
    );

    const payload = {
      companyName: 'Nova Labs',
      roleTitle: 'Risk Analyst',
      externalLink: 'https://example.com/job',
      locationCountry: 'Canada',
      locationCity: 'Toronto',
      submitterName: 'Admin',
      submitterEmail: 'admin@example.com'
    };

    const first = await app.inject({
      method: 'POST',
      url: '/jobs/submissions',
      payload
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: 'POST',
      url: '/jobs/submissions',
      headers: { 'x-forwarded-for': '1.1.1.1' },
      payload
    });
    expect(second.statusCode).toBe(429);

    await app.close();
  });

  it('rejects invalid submission payloads', async () => {
    const app = buildApp(new InMemoryJobRepository([]), new InMemoryClickRepository(), buildTestEnv());
    const res = await app.inject({
      method: 'POST',
      url: '/jobs/submissions',
      payload: {
        companyName: 'Nova Labs',
        roleTitle: 'Risk Analyst'
      }
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('returns a friendly error message for invalid submitter emails', async () => {
    const app = buildApp(new InMemoryJobRepository([]), new InMemoryClickRepository(), buildTestEnv());
    const res = await app.inject({
      method: 'POST',
      url: '/jobs/submissions',
      payload: {
        companyName: 'Nova Labs',
        roleTitle: 'Risk Analyst',
        externalLink: 'https://example.com/job',
        locationCountry: 'Canada',
        locationCity: 'Toronto',
        submitterName: 'Admin',
        submitterEmail: 'not-an-email'
      }
    });

    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: string }).error.toLowerCase()).toContain('email');
    await app.close();
  });

  it('normalizes optional enum-like fields instead of failing the whole submission', async () => {
    const repo = new InMemoryJobRepository([]);
    const app = buildApp(repo, new InMemoryClickRepository(), buildTestEnv());

    const res = await app.inject({
      method: 'POST',
      url: '/jobs/submissions',
      payload: {
        companyName: 'Nova Labs',
        roleTitle: 'Risk Analyst',
        externalLink: 'example.com/job',
        locationCountry: 'Canada',
        locationCity: 'Toronto',
        submitterName: 'Admin',
        submitterEmail: 'admin@example.com',
        remotePolicy: 'hybrid (3 days)',
        employmentType: 'full time',
        seniority: 'sr'
      }
    });

    expect(res.statusCode).toBe(201);
    expect((res.json() as { jobId: string }).jobId).toBeTruthy();
    await app.close();
  });

  it('click endpoint increments only active jobs and dedupes rapid repeated clicks', async () => {
    const pendingJob: JobPosting = {
      id: 'job-pending',
      companyName: 'Acme',
      companyWebsite: 'https://example.com',
      roleTitle: 'Pending Role',
      externalLink: 'https://example.com/apply',
      postedDate: new Date().toISOString(),
      status: 'pending',
      sourceType: 'Direct',
      isVerified: true,
      clicks: 0
    };

    const activeJob: JobPosting = {
      ...pendingJob,
      id: 'job-active',
      roleTitle: 'Active Role',
      status: 'active'
    };

    const app = buildApp(
      new InMemoryJobRepository([pendingJob, activeJob]),
      new InMemoryClickRepository(),
      buildTestEnv({
        RATE_LIMIT_MAX_CLICK: '10',
        CLICK_DEDUPE_WINDOW_MS: '60000'
      })
    );

    const pendingClick = await app.inject({
      method: 'POST',
      url: '/jobs/job-pending/click'
    });
    expect(pendingClick.statusCode).toBe(404);

    const firstActiveClick = await app.inject({
      method: 'POST',
      url: '/jobs/job-active/click'
    });
    expect(firstActiveClick.statusCode).toBe(200);
    expect((firstActiveClick.json() as { clicks: number }).clicks).toBe(1);

    const duplicateClick = await app.inject({
      method: 'POST',
      url: '/jobs/job-active/click'
    });
    expect(duplicateClick.statusCode).toBe(200);
    const duplicateBody = duplicateClick.json() as { clicks: number; deduped?: boolean };
    expect(duplicateBody.clicks).toBe(1);
    expect(duplicateBody.deduped).toBe(true);

    await app.close();
  });

  it('accepts empty JSON body on click endpoint without parser failure', async () => {
    const activeJob: JobPosting = {
      id: 'job-active-empty-json',
      companyName: 'Acme',
      companyWebsite: 'https://example.com',
      roleTitle: 'Active Role',
      externalLink: 'https://example.com/apply',
      postedDate: new Date().toISOString(),
      status: 'active',
      sourceType: 'Direct',
      isVerified: true,
      clicks: 0
    };

    const app = buildApp(new InMemoryJobRepository([activeJob]), new InMemoryClickRepository(), buildTestEnv());

    const clickRes = await app.inject({
      method: 'POST',
      url: '/jobs/job-active-empty-json/click',
      headers: { 'content-type': 'application/json' },
      payload: ''
    });

    expect(clickRes.statusCode).toBe(200);
    const clickBody = clickRes.json() as { ok: boolean; clicks: number };
    expect(clickBody.ok).toBe(true);
    expect(clickBody.clicks).toBe(1);

    await app.close();
  });

  it('click endpoint rate limit applies per request.ip', async () => {
    const activeJob: JobPosting = {
      id: 'job-active',
      companyName: 'Acme',
      companyWebsite: 'https://example.com',
      roleTitle: 'Active Role',
      externalLink: 'https://example.com/apply',
      postedDate: new Date().toISOString(),
      status: 'active',
      sourceType: 'Direct',
      isVerified: true,
      clicks: 0
    };

    const app = buildApp(
      new InMemoryJobRepository([activeJob]),
      new InMemoryClickRepository(),
      buildTestEnv({
        RATE_LIMIT_MAX_CLICK: '1',
        CLICK_DEDUPE_WINDOW_MS: '0'
      })
    );

    const first = await app.inject({
      method: 'POST',
      url: '/jobs/job-active/click'
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: 'POST',
      url: '/jobs/job-active/click',
      headers: { 'x-forwarded-for': '203.0.113.1' }
    });
    expect(second.statusCode).toBe(429);

    await app.close();
  });

  it('fails open on click hydration failures for public search and detail', async () => {
    const activeJob: JobPosting = {
      id: 'job-active',
      companyName: 'Acme',
      companyWebsite: 'https://example.com',
      roleTitle: 'Active Role',
      externalLink: 'https://example.com/apply',
      postedDate: new Date().toISOString(),
      status: 'active',
      sourceType: 'Direct',
      isVerified: true,
      clicks: 7
    };

    const app = buildApp(new InMemoryJobRepository([activeJob]), new FailingClickRepository() as any, buildTestEnv());

    const search = await app.inject({
      method: 'POST',
      url: '/jobs/search',
      payload: {
        feedType: 'direct',
        filters: {
          keyword: '',
          remotePolicies: [],
          seniorityLevels: [],
          employmentTypes: [],
          dateRange: 'all',
          locations: []
        }
      }
    });
    expect(search.statusCode).toBe(200);
    const searchBody = search.json() as { jobs: Array<{ clicks: number }> };
    expect(searchBody.jobs[0].clicks).toBe(7);

    const detail = await app.inject({
      method: 'GET',
      url: '/jobs/job-active'
    });
    expect(detail.statusCode).toBe(200);
    const detailBody = detail.json() as { job: { clicks: number } };
    expect(detailBody.job.clicks).toBe(7);

    await app.close();
  });

  it('fails open on click hydration failures for admin list', async () => {
    const activeJob: JobPosting = {
      id: 'job-active',
      companyName: 'Acme',
      companyWebsite: 'https://example.com',
      roleTitle: 'Active Role',
      externalLink: 'https://example.com/apply',
      postedDate: new Date().toISOString(),
      status: 'active',
      sourceType: 'Direct',
      isVerified: true,
      clicks: 2
    };

    const app = buildApp(new InMemoryJobRepository([activeJob]), new FailingClickRepository() as any, buildTestEnv());

    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/admin-login',
      payload: { username: 'admin', password: 'Tark101' }
    });
    const sessionCookie = getSessionCookie(loginRes.headers as Record<string, unknown>);
    expect(loginRes.statusCode).toBe(200);

    const adminList = await app.inject({
      method: 'GET',
      url: '/admin/jobs',
      headers: { cookie: sessionCookie }
    });
    expect(adminList.statusCode).toBe(200);
    const body = adminList.json() as { jobs: Array<{ clicks: number }> };
    expect(body.jobs[0].clicks).toBe(2);

    await app.close();
  });
});
