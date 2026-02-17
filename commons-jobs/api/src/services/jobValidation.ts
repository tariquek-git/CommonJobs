import { z } from 'zod';
import { sanitizeOptionalUrl, sanitizeTags, sanitizeText } from '../lib/sanitize.js';
import { EmploymentType, JobPosting, JobSourceType, JobStatus, RemotePolicy, SeniorityLevel } from '../types/jobs.js';

const normalizeRemotePolicy = (value: unknown): RemotePolicy | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed === 'Onsite' || trimmed === 'Hybrid' || trimmed === 'Remote') return trimmed;

  const lower = trimmed.toLowerCase();
  if (lower.includes('remote')) return 'Remote';
  if (lower.includes('hybrid')) return 'Hybrid';
  if (lower.includes('on-site') || lower.includes('onsite') || lower === 'on site' || lower === 'on') return 'Onsite';
  return undefined;
};

const normalizeEmploymentType = (value: unknown): EmploymentType | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed === 'Full-time' || trimmed === 'Contract' || trimmed === 'Internship') return trimmed;

  const lower = trimmed.toLowerCase();
  if (lower.includes('full')) return 'Full-time';
  if (lower.includes('contract')) return 'Contract';
  if (lower.includes('intern')) return 'Internship';
  return undefined;
};

const normalizeSeniority = (value: unknown): SeniorityLevel | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed === 'Junior' || trimmed === 'Mid-Level' || trimmed === 'Senior' || trimmed === 'Lead' || trimmed === 'Executive') {
    return trimmed;
  }

  const lower = trimmed.toLowerCase();
  if (lower === 'jr' || lower.includes('junior')) return 'Junior';
  if (lower.includes('mid')) return 'Mid-Level';
  if (lower === 'sr' || lower.includes('senior')) return 'Senior';
  if (lower.includes('lead') || lower.includes('staff') || lower.includes('principal')) return 'Lead';
  if (lower.includes('exec') || lower.includes('director') || lower.includes('vp') || lower.includes('head')) return 'Executive';
  return undefined;
};

const remotePolicySchema = z.enum(['Onsite', 'Hybrid', 'Remote']);
const employmentTypeSchema = z.enum(['Full-time', 'Contract', 'Internship']);
const senioritySchema = z.enum(['Junior', 'Mid-Level', 'Senior', 'Lead', 'Executive']);
const sourceTypeSchema = z.enum(['Direct', 'Aggregated']);
const statusSchema = z.enum(['pending', 'active', 'rejected', 'archived']);

const baseJobSchema = z.object({
  companyName: z.string().min(1).max(120),
  companyWebsite: z.string().optional(),
  roleTitle: z.string().min(1).max(180),
  externalLink: z.string().min(1),
  postedDate: z.string().datetime().optional(),
  status: statusSchema.optional(),
  sourceType: sourceTypeSchema.optional(),
  isVerified: z.boolean().optional(),
  externalSource: z.string().max(120).optional(),
  intelligenceSummary: z.string().max(1200).optional(),
  locationCity: z.string().max(120).optional(),
  locationState: z.string().max(120).optional(),
  locationCountry: z.string().max(120).optional(),
  region: z.string().max(120).optional(),
  remotePolicy: remotePolicySchema.optional(),
  employmentType: employmentTypeSchema.optional(),
  seniority: senioritySchema.optional(),
  salaryRange: z.string().max(120).optional(),
  currency: z.string().max(12).optional(),
  tags: z.array(z.string()).max(10).optional(),
  submitterName: z.string().max(120).optional(),
  submitterEmail: z.string().email().max(200).optional(),
  website: z.string().optional() // honeypot
});

export const publicSubmissionSchema = baseJobSchema.pick({
  companyName: true,
  companyWebsite: true,
  roleTitle: true,
  externalLink: true,
  intelligenceSummary: true,
  locationCity: true,
  locationState: true,
  locationCountry: true,
  remotePolicy: true,
  employmentType: true,
  seniority: true,
  salaryRange: true,
  currency: true,
  tags: true,
  submitterName: true,
  submitterEmail: true,
  website: true
});

export const adminCreateJobSchema = baseJobSchema.extend({
  sourceType: sourceTypeSchema,
  status: statusSchema,
  isVerified: z.boolean(),
  externalLink: z.string().min(1)
});

export const adminUpdateJobSchema = baseJobSchema.partial();

export const adminStatusSchema = z.object({
  status: statusSchema
});

export const searchSchema = z.object({
  feedType: z.enum(['direct', 'aggregated']),
  filters: z.object({
    keyword: z.string().default(''),
    remotePolicies: z.array(remotePolicySchema).default([]),
    seniorityLevels: z.array(senioritySchema).default([]),
    employmentTypes: z.array(employmentTypeSchema).default([]),
    dateRange: z.enum(['all', '24h', '7d', '30d']).default('all'),
    locations: z.array(z.string()).default([])
  })
});

const cleanString = (value: unknown, maxLength: number): string | undefined => {
  return sanitizeText(value, maxLength);
};

export const normalizeIncomingJob = (input: Record<string, unknown>) => {
  const companyWebsite = sanitizeOptionalUrl(input.companyWebsite);
  const externalLink = sanitizeOptionalUrl(input.externalLink);

  return {
    companyName: cleanString(input.companyName, 120),
    companyWebsite: companyWebsite || '',
    roleTitle: cleanString(input.roleTitle, 180),
    externalLink,
    postedDate: cleanString(input.postedDate, 40),
    status: input.status as JobStatus | undefined,
    sourceType: input.sourceType as JobSourceType | undefined,
    isVerified: typeof input.isVerified === 'boolean' ? input.isVerified : undefined,
    externalSource: cleanString(input.externalSource, 120),
    intelligenceSummary: cleanString(input.intelligenceSummary, 1200),
    locationCity: cleanString(input.locationCity, 120),
    locationState: cleanString(input.locationState, 120),
    locationCountry: cleanString(input.locationCountry, 120),
    region: cleanString(input.region, 120),
    // Defensive normalization: optional enums often come from AI or client selects with empty values.
    // Treat unknown/blank values as undefined instead of failing the entire submission.
    remotePolicy: normalizeRemotePolicy(input.remotePolicy),
    employmentType: normalizeEmploymentType(input.employmentType),
    seniority: normalizeSeniority(input.seniority),
    salaryRange: cleanString(input.salaryRange, 120),
    currency: cleanString(input.currency, 12),
    tags: sanitizeTags(input.tags),
    submitterName: cleanString(input.submitterName, 120),
    submitterEmail: cleanString(input.submitterEmail, 200),
    website: cleanString(input.website, 120)
  };
};

export const ensurePublicJob = (input: ReturnType<typeof normalizeIncomingJob>): Omit<JobPosting, 'id' | 'clicks' | 'postedDate'> & { postedDate?: string } => {
  return {
    companyName: input.companyName || '',
    companyWebsite: input.companyWebsite || '',
    roleTitle: input.roleTitle || '',
    externalLink: input.externalLink || '',
    postedDate: input.postedDate,
    status: 'pending',
    sourceType: 'Direct',
    isVerified: true,
    externalSource: input.externalSource || 'Direct',
    intelligenceSummary: input.intelligenceSummary,
    locationCity: input.locationCity,
    locationState: input.locationState,
    locationCountry: input.locationCountry,
    region: input.region,
    remotePolicy: input.remotePolicy,
    employmentType: input.employmentType,
    seniority: input.seniority,
    salaryRange: input.salaryRange,
    currency: input.currency,
    tags: input.tags,
    submitterName: input.submitterName,
    submitterEmail: input.submitterEmail
  };
};
