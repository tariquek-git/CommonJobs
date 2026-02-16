import { SupabaseClient } from '@supabase/supabase-js';
import { JobPosting } from '../types/jobs.js';
import { JobRepository } from './jobRepository.js';

type SupabaseJobRow = {
  id: string;
  payload: unknown;
  status: string;
  source_type: string;
  is_verified: boolean;
  posted_date: string;
};

const cloneJob = (job: JobPosting): JobPosting => ({
  ...job,
  tags: job.tags ? [...job.tags] : undefined
});

const asString = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);
const asOptionalString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);
const asStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const out = value.filter((entry): entry is string => typeof entry === 'string');
  return out.length > 0 ? out : undefined;
};

const parsePayload = (payload: unknown): Partial<JobPosting> => {
  if (!payload || typeof payload !== 'object') return {};
  return payload as Partial<JobPosting>;
};

const toRow = (job: JobPosting) => ({
  id: job.id,
  payload: job,
  status: job.status,
  source_type: job.sourceType,
  is_verified: job.isVerified,
  posted_date: job.postedDate
});

const fromRow = (row: SupabaseJobRow): JobPosting => {
  const payload = parsePayload(row.payload);

  return {
    id: row.id,
    companyName: asString(payload.companyName),
    companyWebsite: asString(payload.companyWebsite),
    roleTitle: asString(payload.roleTitle),
    externalLink: asString(payload.externalLink),
    postedDate: asString(payload.postedDate, row.posted_date),
    status: payload.status ?? (row.status as JobPosting['status']),
    sourceType: payload.sourceType ?? (row.source_type as JobPosting['sourceType']),
    isVerified: payload.isVerified ?? row.is_verified,
    externalSource: asOptionalString(payload.externalSource),
    intelligenceSummary: asOptionalString(payload.intelligenceSummary),
    locationCity: asOptionalString(payload.locationCity),
    locationState: asOptionalString(payload.locationState),
    locationCountry: asOptionalString(payload.locationCountry),
    region: asOptionalString(payload.region),
    remotePolicy: payload.remotePolicy,
    employmentType: payload.employmentType,
    seniority: payload.seniority,
    salaryRange: asOptionalString(payload.salaryRange),
    currency: asOptionalString(payload.currency),
    tags: asStringArray(payload.tags),
    submitterName: asOptionalString(payload.submitterName),
    submitterEmail: asOptionalString(payload.submitterEmail),
    clicks: typeof payload.clicks === 'number' && Number.isFinite(payload.clicks) ? payload.clicks : 0
  };
};

const chunk = <T>(items: T[], size: number): T[][] => {
  if (items.length <= size) return [items];
  const out: T[][] = [];
  for (let idx = 0; idx < items.length; idx += size) {
    out.push(items.slice(idx, idx + size));
  }
  return out;
};

export class SupabaseJobRepository implements JobRepository {
  private readonly supabase: SupabaseClient;
  private readonly tableName: string;
  private queue: Promise<void> = Promise.resolve();

  constructor(supabase: SupabaseClient, tableName = 'job_board_jobs') {
    this.supabase = supabase;
    this.tableName = tableName;
  }

  async list(): Promise<JobPosting[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('id,payload,status,source_type,is_verified,posted_date')
      .order('posted_date', { ascending: false });

    if (error) {
      throw new Error(`Failed to load jobs from Supabase: ${error.message}`);
    }

    return (data ?? []).map((row) => fromRow(row as SupabaseJobRow));
  }

  async mutate<T>(mutator: (jobs: JobPosting[]) => Promise<T> | T): Promise<T> {
    const run = this.queue.then(async () => {
      const currentJobs = await this.list();
      const workingCopy = currentJobs.map(cloneJob);
      const result = await mutator(workingCopy);

      const rows = workingCopy.map(toRow);
      for (const rowsChunk of chunk(rows, 250)) {
        const { error } = await this.supabase
          .from(this.tableName)
          .upsert(rowsChunk, { onConflict: 'id' });

        if (error) {
          throw new Error(`Failed to save jobs to Supabase: ${error.message}`);
        }
      }

      const previousIds = new Set(currentJobs.map((job) => job.id));
      const nextIds = new Set(workingCopy.map((job) => job.id));
      const removedIds = Array.from(previousIds).filter((id) => !nextIds.has(id));

      for (const idsChunk of chunk(removedIds, 250)) {
        const { error } = await this.supabase.from(this.tableName).delete().in('id', idsChunk);
        if (error) {
          throw new Error(`Failed to delete removed jobs from Supabase: ${error.message}`);
        }
      }

      return result;
    });

    this.queue = run.then(() => undefined, () => undefined);
    return run;
  }
}
