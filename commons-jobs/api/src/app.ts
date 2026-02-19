import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createAdminToken, verifyAdminToken } from './auth/adminAuth.js';
import { verifyAdminPassword } from './auth/adminPassword.js';
import { AppEnv, parseAllowedOrigins } from './config/env.js';
import { checkRateLimit } from './lib/rateLimit.js';
import { applySecurityHeaders } from './lib/securityHeaders.js';
import { badRequest, notFound, tooManyRequests, unauthorized } from './lib/http.js';
import { filterPublicJobs } from './services/filterJobs.js';
import {
  adminCreateJobSchema,
  adminStatusSchema,
  adminUpdateJobSchema,
  ensurePublicJob,
  normalizeIncomingJob,
  publicSubmissionSchema,
  searchSchema
} from './services/jobValidation.js';
import { ClickRepository } from './storage/clickRepository.js';
import { JobRepository } from './storage/jobRepository.js';
import { createAiService, heuristicAnalyzeJobDescription, heuristicParseSearchQuery } from './services/aiService.js';
import { JobPosting } from './types/jobs.js';

export const buildApp = (
  repository: JobRepository,
  clickRepository: ClickRepository,
  appEnv: AppEnv,
  aiServiceOverride?: ReturnType<typeof createAiService>
) => {
  const app = Fastify({
    logger: appEnv.NODE_ENV !== 'test',
    trustProxy: appEnv.TRUST_PROXY
  });
  const allowedOrigins = parseAllowedOrigins(appEnv.CLIENT_ORIGIN);
  const aiService = aiServiceOverride ?? createAiService(appEnv.GEMINI_API_KEY, appEnv.GEMINI_MODEL);
  const clickDedupeWindow = Math.max(1, appEnv.CLICK_DEDUPE_WINDOW_MS);
  const clickDedupe = new Map<string, number>();

  app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('Origin not allowed'), false);
    }
  });

  app.addHook('onRequest', applySecurityHeaders);
  app.setErrorHandler((error, _request, reply) => {
    const statusCode = typeof (error as { statusCode?: number }).statusCode === 'number'
      ? (error as { statusCode: number }).statusCode
      : 500;
    const errorMessage = error instanceof Error ? error.message : 'Request failed';

    if (statusCode >= 500) {
      app.log.error(error);
    }

    return reply.status(statusCode).send({
      error: statusCode >= 500 ? 'Internal server error' : errorMessage
    });
  });

  const adminGuard = (authorization?: string) => {
    if (!appEnv.ADMIN_TOKEN_SECRET) return false;
    if (!authorization || !authorization.startsWith('Bearer ')) return false;
    const token = authorization.slice('Bearer '.length);
    return verifyAdminToken(token, appEnv.ADMIN_TOKEN_SECRET);
  };

  const hydrateClicks = async (jobs: JobPosting[]): Promise<JobPosting[]> => {
    if (jobs.length === 0) return [];
    const clickMap = await clickRepository.getMany(jobs.map((job) => job.id));
    return jobs.map((job) => ({
      ...job,
      clicks: clickMap[job.id] ?? job.clicks ?? 0
    }));
  };

  const isDuplicateClick = (jobId: string, ip: string): boolean => {
    const now = Date.now();
    const key = `${jobId}:${ip}`;
    const lastSeen = clickDedupe.get(key);
    clickDedupe.set(key, now);

    if (clickDedupe.size > 5000) {
      for (const [entryKey, timestamp] of clickDedupe.entries()) {
        if (now - timestamp > clickDedupeWindow) {
          clickDedupe.delete(entryKey);
        }
      }
    }

    return typeof lastSeen === 'number' && now - lastSeen < clickDedupeWindow;
  };

  const submissionValidationMessage = (issues: Array<{ path: PropertyKey[] }>): string => {
    const topLevel = new Set(issues.map((issue) => String(issue.path?.[0] ?? '')));
    if (topLevel.has('externalLink')) return 'Please provide a valid apply link (URL).';
    if (topLevel.has('submitterEmail')) return 'Please provide a valid email address.';
    if (topLevel.has('companyName') || topLevel.has('roleTitle')) return 'Company name and role title are required.';
    if (topLevel.has('locationCountry') || topLevel.has('locationCity')) return 'Please provide a country and city.';
    return 'Invalid submission payload';
  };

  app.get('/health', async () => ({ ok: true, timestamp: new Date().toISOString() }));

  app.post('/auth/admin-login', async (request, reply) => {
    const ip = request.ip;
    const limit = checkRateLimit(`admin-login:${ip}`, {
      windowMs: appEnv.RATE_LIMIT_WINDOW_MS,
      maxRequests: appEnv.RATE_LIMIT_MAX_ADMIN_LOGIN
    });
    if (!limit.ok) return tooManyRequests(reply, limit.retryAfterSec);

    if (!appEnv.ADMIN_USERNAME || !appEnv.ADMIN_PASSWORD_HASH || !appEnv.ADMIN_TOKEN_SECRET) {
      return reply.status(503).send({ error: 'Admin auth is not configured' });
    }

    const body = (request.body || {}) as { username?: string; password?: string };
    if (!body.username || !body.password) return badRequest(reply, 'Username and password required');
    if (body.username !== appEnv.ADMIN_USERNAME) return unauthorized(reply, 'Invalid credentials');

    const validPassword = await verifyAdminPassword(body.password, appEnv.ADMIN_PASSWORD_HASH);
    if (!validPassword) return unauthorized(reply, 'Invalid credentials');

    return { token: createAdminToken(appEnv.ADMIN_TOKEN_SECRET) };
  });

  app.post('/jobs/search', async (request, reply) => {
    const parsed = searchSchema.safeParse(request.body || {});
    if (!parsed.success) return badRequest(reply, 'Invalid search request');

    const jobs = await repository.list();
    const filtered = filterPublicJobs(jobs, parsed.data.filters, parsed.data.feedType);
    return { jobs: await hydrateClicks(filtered) };
  });

  app.get('/jobs/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const jobs = await repository.list();
    const job = jobs.find((j) => j.id === params.id);
    if (!job) return notFound(reply, 'Job not found');

    const isAdmin = adminGuard(request.headers.authorization);
    if (!isAdmin && job.status !== 'active') return notFound(reply, 'Job not found');
    const clicks = await clickRepository.get(job.id);
    return { job: { ...job, clicks } };
  });

  app.post('/jobs/:id/click', async (request, reply) => {
    const ip = request.ip;
    const limit = checkRateLimit(`job-click:${ip}`, {
      windowMs: appEnv.RATE_LIMIT_WINDOW_MS,
      maxRequests: appEnv.RATE_LIMIT_MAX_CLICK
    });
    if (!limit.ok) return tooManyRequests(reply, limit.retryAfterSec);

    const params = request.params as { id: string };
    const jobs = await repository.list();
    const job = jobs.find((j) => j.id === params.id && j.status === 'active');
    if (!job) return notFound(reply, 'Job not found');

    if (isDuplicateClick(params.id, ip)) {
      return { ok: true, deduped: true, clicks: await clickRepository.get(params.id) };
    }

    return { ok: true, clicks: await clickRepository.increment(params.id) };
  });

  app.post('/jobs/submissions', async (request, reply) => {
    const ip = request.ip;
    const limit = checkRateLimit(`job-submit:${ip}`, {
      windowMs: appEnv.RATE_LIMIT_WINDOW_MS,
      maxRequests: appEnv.RATE_LIMIT_MAX_SUBMIT
    });
    if (!limit.ok) return tooManyRequests(reply, limit.retryAfterSec);

    const normalized = normalizeIncomingJob((request.body || {}) as Record<string, unknown>);
    const parsed = publicSubmissionSchema.safeParse(normalized);
    if (!parsed.success) {
      app.log.info({ issues: parsed.error.issues }, 'Invalid job submission payload');
      return badRequest(reply, submissionValidationMessage(parsed.error.issues));
    }

    if (normalized.website) {
      return badRequest(reply, 'Invalid submission payload');
    }

    if (!normalized.externalLink) {
      return badRequest(reply, 'A valid apply link is required');
    }

    const payload = ensurePublicJob(normalized);

    const newJob = await repository.mutate((jobs) => {
      const created: JobPosting = {
        ...payload,
        id: crypto.randomUUID(),
        postedDate: payload.postedDate || new Date().toISOString(),
        clicks: 0
      };
      jobs.unshift(created);
      return created;
    });

    return reply.status(201).send({ ok: true, jobId: newJob.id });
  });

  app.get('/admin/jobs', async (request, reply) => {
    if (!adminGuard(request.headers.authorization)) {
      return unauthorized(reply);
    }

    const jobs = await repository.list();
    const withClicks = await hydrateClicks(jobs);
    withClicks.sort((a, b) => new Date(b.postedDate).getTime() - new Date(a.postedDate).getTime());
    return { jobs: withClicks };
  });

  app.get('/admin/runtime', async (request, reply) => {
    if (!adminGuard(request.headers.authorization)) {
      return unauthorized(reply);
    }

    const storageProbe: {
      ok: boolean;
      totalJobs: number | null;
      error: string | null;
    } = {
      ok: true,
      totalJobs: null,
      error: null
    };

    try {
      const jobs = await repository.list();
      storageProbe.totalJobs = jobs.length;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown storage error';
      storageProbe.ok = false;
      storageProbe.error = message;
      app.log.error({ err: error }, 'Admin runtime storage probe failed');
      console.error('Admin runtime storage probe failed:', message);
    }

    // Intentionally omit secrets; this is for deployment/debug visibility only.
    return {
      ok: true,
      provider: appEnv.STORAGE_PROVIDER,
      tables: {
        jobs: appEnv.SUPABASE_JOBS_TABLE,
        clicks: appEnv.SUPABASE_CLICKS_TABLE
      },
      gemini: {
        enabled: Boolean(appEnv.GEMINI_API_KEY),
        model: appEnv.GEMINI_MODEL
      },
      env: {
        nodeEnv: appEnv.NODE_ENV,
        trustProxy: appEnv.TRUST_PROXY
      },
      storageProbe,
      vercel: {
        gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
        deploymentId: process.env.VERCEL_DEPLOYMENT_ID || null
      }
    };
  });

  app.post('/admin/jobs', async (request, reply) => {
    if (!adminGuard(request.headers.authorization)) {
      return unauthorized(reply);
    }

    const normalized = normalizeIncomingJob((request.body || {}) as Record<string, unknown>);
    const parsed = adminCreateJobSchema.safeParse(normalized);
    const externalLink = normalized.externalLink;
    if (!parsed.success || !externalLink) {
      return badRequest(reply, 'Invalid job payload');
    }

    const newJob = await repository.mutate((jobs) => {
      const created: JobPosting = {
        id: crypto.randomUUID(),
        companyName: parsed.data.companyName,
        companyWebsite: parsed.data.companyWebsite || '',
        roleTitle: parsed.data.roleTitle,
        externalLink,
        postedDate: parsed.data.postedDate || new Date().toISOString(),
        status: parsed.data.status,
        sourceType: parsed.data.sourceType,
        isVerified: parsed.data.isVerified,
        externalSource: parsed.data.externalSource,
        intelligenceSummary: parsed.data.intelligenceSummary,
        locationCity: parsed.data.locationCity,
        locationState: parsed.data.locationState,
        locationCountry: parsed.data.locationCountry,
        region: parsed.data.region,
        remotePolicy: parsed.data.remotePolicy,
        employmentType: parsed.data.employmentType,
        seniority: parsed.data.seniority,
        salaryRange: parsed.data.salaryRange,
        currency: parsed.data.currency,
        tags: parsed.data.tags,
        submitterName: parsed.data.submitterName,
        submitterEmail: parsed.data.submitterEmail,
        clicks: 0
      };

      jobs.unshift(created);
      return created;
    });

    return reply.status(201).send({ job: newJob });
  });

  app.patch('/admin/jobs/:id/status', async (request, reply) => {
    if (!adminGuard(request.headers.authorization)) {
      return unauthorized(reply);
    }

    const params = request.params as { id: string };
    const parsed = adminStatusSchema.safeParse(request.body || {});
    if (!parsed.success) return badRequest(reply, 'Invalid status payload');

    const updated = await repository.mutate((jobs) => {
      const idx = jobs.findIndex((job) => job.id === params.id);
      if (idx < 0) return null;

      jobs[idx] = { ...jobs[idx], status: parsed.data.status };
      return jobs[idx];
    });

    if (!updated) return notFound(reply, 'Job not found');
    return { job: { ...updated, clicks: await clickRepository.get(updated.id) } };
  });

  app.patch('/admin/jobs/:id', async (request, reply) => {
    if (!adminGuard(request.headers.authorization)) {
      return unauthorized(reply);
    }

    const params = request.params as { id: string };
    const normalized = normalizeIncomingJob((request.body || {}) as Record<string, unknown>);
    const parsed = adminUpdateJobSchema.safeParse(normalized);
    if (!parsed.success) return badRequest(reply, 'Invalid job payload');

    const updated = await repository.mutate((jobs) => {
      const idx = jobs.findIndex((job) => job.id === params.id);
      if (idx < 0) return null;

      const current = jobs[idx];
      const next: JobPosting = {
        ...current,
        ...Object.fromEntries(Object.entries(parsed.data).filter(([, value]) => value !== undefined)),
        externalLink: normalized.externalLink || current.externalLink,
        companyWebsite: normalized.companyWebsite ?? current.companyWebsite,
        tags: normalized.tags || current.tags
      };

      jobs[idx] = next;
      return next;
    });

    if (!updated) return notFound(reply, 'Job not found');
    return { job: { ...updated, clicks: await clickRepository.get(updated.id) } };
  });

  app.post('/ai/analyze-job', async (request, reply) => {
    const ip = request.ip;
    const limit = checkRateLimit(`ai:${ip}`, {
      windowMs: appEnv.RATE_LIMIT_WINDOW_MS,
      maxRequests: appEnv.RATE_LIMIT_MAX_AI
    });
    if (!limit.ok) return tooManyRequests(reply, limit.retryAfterSec);

    if (!appEnv.GEMINI_API_KEY) {
      return reply.status(503).send({ error: 'AI is not configured' });
    }

    const body = (request.body || {}) as { description?: string };
    if (!body.description) return badRequest(reply, 'Description required');
    const result = await aiService.analyzeJobDescription(body.description);
    if (!result) {
      return { result: heuristicAnalyzeJobDescription(body.description), fallback: true };
    }
    return { result, fallback: false };
  });

  app.post('/ai/parse-search', async (request, reply) => {
    const ip = request.ip;
    const limit = checkRateLimit(`ai:${ip}`, {
      windowMs: appEnv.RATE_LIMIT_WINDOW_MS,
      maxRequests: appEnv.RATE_LIMIT_MAX_AI
    });
    if (!limit.ok) return tooManyRequests(reply, limit.retryAfterSec);

    if (!appEnv.GEMINI_API_KEY) {
      return reply.status(503).send({ error: 'AI is not configured' });
    }

    const body = (request.body || {}) as { query?: string };
    if (!body.query) return badRequest(reply, 'Query required');
    const result = await aiService.parseSearchQuery(body.query);
    if (!result) {
      return { result: heuristicParseSearchQuery(body.query), fallback: true };
    }
    return { result, fallback: false };
  });

  return app;
};
