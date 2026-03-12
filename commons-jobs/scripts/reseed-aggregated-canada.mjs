#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = (process.env.BASE_URL || 'https://fintechcommons.com').replace(/\/+$/, '');
const adminUsername = process.env.ADMIN_USERNAME;
const adminPassword = process.env.ADMIN_PASSWORD;
const targetCount = Number(process.env.SEED_TARGET_COUNT || 30);
const maxPerCompany = Number(process.env.SEED_MAX_PER_COMPANY || 5);
const maxAgeDays = Number(process.env.SEED_MAX_AGE_DAYS || 12);
const archiveExistingAggregated = process.env.ARCHIVE_EXISTING_AGGREGATED !== '0';
const dryRun = process.env.DRY_RUN === '1';

const OUTPUT_DIR = path.resolve(process.cwd(), 'output');
const SOURCE_CONFIG = [
  {
    provider: 'lever',
    token: 'eqbank',
    companyName: 'EQ Bank',
    companyWebsite: 'https://www.eqbank.ca'
  },
  {
    provider: 'greenhouse',
    token: 'shakepay',
    companyName: 'Shakepay',
    companyWebsite: 'https://shakepay.com'
  },
  {
    provider: 'greenhouse',
    token: 'stripe',
    companyName: 'Stripe',
    companyWebsite: 'https://stripe.com'
  },
  {
    provider: 'greenhouse',
    token: 'affirm',
    companyName: 'Affirm',
    companyWebsite: 'https://www.affirm.com'
  },
  {
    provider: 'greenhouse',
    token: 'marqeta',
    companyName: 'Marqeta',
    companyWebsite: 'https://www.marqeta.com'
  },
  {
    provider: 'greenhouse',
    token: 'coinbase',
    companyName: 'Coinbase',
    companyWebsite: 'https://www.coinbase.com'
  },
  {
    provider: 'greenhouse',
    token: 'nubank',
    companyName: 'Nubank',
    companyWebsite: 'https://nubank.com.br'
  }
];

const CANADA_LOCATION_HINTS = [
  'canada',
  'toronto',
  'vancouver',
  'montreal',
  'calgary',
  'ottawa',
  'waterloo',
  'edmonton',
  'winnipeg',
  'quebec city',
  'quebec',
  'halifax'
];

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const truncate = (value, max) => {
  if (!value) return undefined;
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
};

const stripHtml = (value) => {
  if (!value) return '';
  const decoded = value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;nbsp;/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  return decoded
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<\/?[^>]+>/g, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const toIsoOrNow = (rawDate, now = Date.now()) => {
  if (typeof rawDate === 'number' && Number.isFinite(rawDate) && rawDate > 0) {
    return new Date(rawDate).toISOString();
  }
  if (typeof rawDate === 'string' && rawDate.trim()) {
    const parsed = Date.parse(rawDate);
    if (Number.isFinite(parsed) && parsed > 0) {
      return new Date(parsed).toISOString();
    }
  }
  return new Date(now).toISOString();
};

const isWithinAgeWindow = (isoDate, maxAgeMs, now = Date.now()) => {
  const parsed = Date.parse(isoDate);
  if (!Number.isFinite(parsed) || parsed <= 0) return true;
  return now - parsed <= maxAgeMs;
};

const isCanadianLocation = (value) => {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return CANADA_LOCATION_HINTS.some((hint) => normalized.includes(hint));
};

const parseLocation = (rawLocation) => {
  if (!rawLocation) {
    return {
      locationCity: undefined,
      locationCountry: 'Canada',
      region: 'Canada'
    };
  }

  const normalized = rawLocation.replace(/\s+/g, ' ').trim();
  const lower = normalized.toLowerCase();

  if (lower.includes('remote')) {
    return {
      locationCity: 'Remote',
      locationCountry: 'Canada',
      region: 'Canada'
    };
  }

  const parts = normalized.split(',').map((part) => part.trim()).filter(Boolean);
  const locationCity = parts[0] ? truncate(parts[0], 120) : undefined;
  return {
    locationCity,
    locationCountry: 'Canada',
    region: 'Canada'
  };
};

const inferRemotePolicy = (rawLocation, workplaceType) => {
  const normalized = `${rawLocation || ''} ${workplaceType || ''}`.toLowerCase();
  if (normalized.includes('hybrid')) return 'Hybrid';
  if (normalized.includes('remote')) return 'Remote';
  if (normalized.includes('on-site') || normalized.includes('onsite') || normalized.includes('office')) return 'Onsite';
  return undefined;
};

const inferEmploymentType = (rawCommitment) => {
  const normalized = (rawCommitment || '').toLowerCase();
  if (normalized.includes('intern')) return 'Internship';
  if (normalized.includes('contract')) return 'Contract';
  if (normalized.includes('full')) return 'Full-time';
  return undefined;
};

const inferSeniority = (roleTitle) => {
  const normalized = (roleTitle || '').toLowerCase();
  if (normalized.includes('intern') || normalized.includes('junior')) return 'Junior';
  if (normalized.includes('staff') || normalized.includes('principal') || normalized.includes('lead')) return 'Lead';
  if (normalized.includes('director') || normalized.includes('vp') || normalized.includes('head')) return 'Executive';
  if (normalized.includes('senior') || normalized.includes('sr')) return 'Senior';
  if (normalized.includes('analyst') || normalized.includes('associate')) return 'Mid-Level';
  return undefined;
};

const normalizeSummary = (rawDescription) => {
  const plain = stripHtml(rawDescription);
  if (!plain) return undefined;
  return truncate(plain, 280);
};

const requestJson = async (pathName, options = {}) => {
  const response = await fetch(`${baseUrl}${pathName}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {})
    }
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { response, body };
};

const loginAdmin = async () => {
  assert(adminUsername && adminPassword, 'ADMIN_USERNAME and ADMIN_PASSWORD are required');
  const { response, body } = await requestJson('/api/auth/admin-login', {
    method: 'POST',
    body: JSON.stringify({ username: adminUsername, password: adminPassword })
  });
  assert(response.status === 200, `admin login failed (${response.status})`);
  assert(body?.ok === true, 'admin login response missing ok=true');
  const cookie = response.headers.get('set-cookie') || '';
  assert(cookie.includes('='), 'admin login did not return session cookie');
  return cookie;
};

const fetchAdminJobs = async (cookie) => {
  const { response, body } = await requestJson('/api/admin/jobs', {
    method: 'GET',
    headers: { cookie }
  });
  assert(response.status === 200, `admin jobs fetch failed (${response.status})`);
  return Array.isArray(body?.jobs) ? body.jobs : [];
};

const archiveJob = async (cookie, jobId, note) => {
  const { response } = await requestJson(`/api/admin/jobs/${jobId}/status`, {
    method: 'PATCH',
    headers: { cookie },
    body: JSON.stringify({ status: 'archived', moderationNote: note })
  });
  assert(response.status === 200, `archive failed for ${jobId} (${response.status})`);
};

const createJob = async (cookie, payload) => {
  const { response, body } = await requestJson('/api/admin/jobs', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify(payload)
  });
  assert(response.status === 201, `create failed (${response.status})`);
  assert(body?.job?.id, 'create response missing job id');
  return body.job.id;
};

const fetchFromLever = async (source) => {
  const response = await fetch(`https://api.lever.co/v0/postings/${source.token}?mode=json`);
  if (response.status !== 200) {
    throw new Error(`Lever source ${source.token} unavailable (${response.status})`);
  }
  const rows = await response.json();
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => {
      const location = row?.categories?.location || '';
      return {
        companyName: source.companyName,
        companyWebsite: source.companyWebsite,
        roleTitle: truncate(row?.text || '', 180),
        externalLink: row?.hostedUrl || '',
        postedDate: toIsoOrNow(row?.createdAt || row?.updatedAt),
        rawLocation: location,
        location: parseLocation(location),
        remotePolicy: inferRemotePolicy(location, row?.workplaceType),
        employmentType: inferEmploymentType(row?.categories?.commitment),
        seniority: inferSeniority(row?.text || ''),
        intelligenceSummary: normalizeSummary(row?.descriptionPlain || row?.description),
        tags: [row?.categories?.team, row?.categories?.department]
          .map((value) => truncate((value || '').trim(), 32))
          .filter(Boolean),
        sourceType: 'Aggregated',
        status: 'active',
        isVerified: false,
        externalSource: source.companyName
      };
    })
    .filter((candidate) => candidate.roleTitle && candidate.externalLink);
};

const fetchFromGreenhouse = async (source) => {
  const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${source.token}/jobs?content=true`);
  if (response.status !== 200) {
    throw new Error(`Greenhouse source ${source.token} unavailable (${response.status})`);
  }
  const body = await response.json();
  const rows = Array.isArray(body?.jobs) ? body.jobs : [];

  return rows
    .map((row) => {
      const location = row?.location?.name || '';
      const tags = [];
      if (Array.isArray(row?.departments)) {
        for (const department of row.departments) {
          if (department?.name) tags.push(department.name);
        }
      }
      if (Array.isArray(row?.offices)) {
        for (const office of row.offices) {
          if (office?.name) tags.push(office.name);
        }
      }

      return {
        companyName: source.companyName,
        companyWebsite: source.companyWebsite,
        roleTitle: truncate(row?.title || '', 180),
        externalLink: row?.absolute_url || '',
        postedDate: toIsoOrNow(row?.updated_at || row?.first_published || row?.created_at),
        rawLocation: location,
        location: parseLocation(location),
        remotePolicy: inferRemotePolicy(location),
        employmentType: undefined,
        seniority: inferSeniority(row?.title || ''),
        intelligenceSummary: normalizeSummary(row?.content),
        tags: tags.map((tag) => truncate(tag, 32)).filter(Boolean).slice(0, 6),
        sourceType: 'Aggregated',
        status: 'active',
        isVerified: false,
        externalSource: source.companyName
      };
    })
    .filter((candidate) => candidate.roleTitle && candidate.externalLink);
};

const fetchCandidates = async () => {
  const all = [];
  for (const source of SOURCE_CONFIG) {
    try {
      const rows =
        source.provider === 'lever'
          ? await fetchFromLever(source)
          : await fetchFromGreenhouse(source);
      all.push(...rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Skipping source ${source.token}: ${message}`);
    }
  }
  return all;
};

const selectCandidates = (allCandidates) => {
  const now = Date.now();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const seenLinks = new Set();
  const grouped = new Map();

  for (const candidate of allCandidates) {
    if (!isCanadianLocation(candidate.rawLocation || '')) continue;
    if (!isWithinAgeWindow(candidate.postedDate, maxAgeMs, now)) continue;

    const linkKey = candidate.externalLink.trim().toLowerCase();
    if (!linkKey || seenLinks.has(linkKey)) continue;
    seenLinks.add(linkKey);

    const companyKey = candidate.companyName.toLowerCase();
    if (!grouped.has(companyKey)) grouped.set(companyKey, []);
    grouped.get(companyKey).push(candidate);
  }

  for (const candidates of grouped.values()) {
    candidates.sort((a, b) => Date.parse(b.postedDate) - Date.parse(a.postedDate));
  }

  const companyOrder = SOURCE_CONFIG.map((source) => source.companyName.toLowerCase()).filter((key) => grouped.has(key));
  const selected = [];
  const selectedPerCompany = new Map();

  while (selected.length < targetCount) {
    let addedAny = false;
    for (const companyKey of companyOrder) {
      const candidates = grouped.get(companyKey);
      if (!candidates || candidates.length === 0) continue;
      const companyCount = selectedPerCompany.get(companyKey) || 0;
      if (companyCount >= maxPerCompany) continue;

      const next = candidates.shift();
      if (!next) continue;
      selected.push(next);
      selectedPerCompany.set(companyKey, companyCount + 1);
      addedAny = true;

      if (selected.length >= targetCount) break;
    }

    if (!addedAny) break;
  }

  return { selected, selectedPerCompany };
};

const run = async () => {
  const startedAt = new Date().toISOString();
  const cookie = await loginAdmin();
  const existingJobs = await fetchAdminJobs(cookie);

  const archivedIds = [];
  if (archiveExistingAggregated && !dryRun) {
    const toArchive = existingJobs.filter((job) => job.sourceType === 'Aggregated' && job.status !== 'archived');
    for (const job of toArchive) {
      await archiveJob(cookie, job.id, 'Archived during Web Pulse reseed.');
      archivedIds.push(job.id);
    }
  }

  const candidates = await fetchCandidates();
  const { selected, selectedPerCompany } = selectCandidates(candidates);
  assert(selected.length > 0, 'No eligible Canadian roles found for seeding');

  const created = [];
  if (!dryRun) {
    for (const candidate of selected) {
      const payload = {
        companyName: candidate.companyName,
        companyWebsite: candidate.companyWebsite,
        roleTitle: candidate.roleTitle,
        externalLink: candidate.externalLink,
        postedDate: candidate.postedDate,
        status: 'active',
        sourceType: 'Aggregated',
        isVerified: false,
        externalSource: candidate.externalSource,
        intelligenceSummary: candidate.intelligenceSummary,
        locationCity: candidate.location.locationCity,
        locationCountry: candidate.location.locationCountry,
        region: candidate.location.region,
        remotePolicy: candidate.remotePolicy,
        employmentType: candidate.employmentType,
        seniority: candidate.seniority,
        tags: candidate.tags?.slice(0, 8)
      };
      const id = await createJob(cookie, payload);
      created.push({
        id,
        companyName: candidate.companyName,
        roleTitle: candidate.roleTitle,
        externalLink: candidate.externalLink,
        postedDate: candidate.postedDate
      });
    }
  }

  const datePart = startedAt.slice(0, 10);
  await mkdir(OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(OUTPUT_DIR, `seed-created-${datePart}.json`);
  const report = {
    ok: true,
    baseUrl,
    startedAt,
    dryRun,
    archiveExistingAggregated,
    targetCount,
    maxPerCompany,
    maxAgeDays,
    candidatesFetched: candidates.length,
    selected: selected.length,
    archivedAggregated: archivedIds.length,
    archivedIds,
    selectedPerCompany: Object.fromEntries(selectedPerCompany.entries()),
    created
  };
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify(report, null, 2));
  console.log(`Report written to ${outputPath}`);
};

run().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
