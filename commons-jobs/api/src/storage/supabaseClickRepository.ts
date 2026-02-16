import { SupabaseClient } from '@supabase/supabase-js';
import { ClickRepository } from './clickRepository.js';

type ClickRow = {
  job_id: string;
  clicks: number;
};

const normalizeCount = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  return 0;
};

export class SupabaseClickRepository implements ClickRepository {
  private readonly supabase: SupabaseClient;
  private readonly tableName: string;
  private queue: Promise<void> = Promise.resolve();

  constructor(supabase: SupabaseClient, tableName = 'job_board_clicks') {
    this.supabase = supabase;
    this.tableName = tableName;
  }

  async get(jobId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('clicks')
      .eq('job_id', jobId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load click count from Supabase: ${error.message}`);
    }

    return normalizeCount(data?.clicks);
  }

  async getMany(jobIds: string[]): Promise<Record<string, number>> {
    if (jobIds.length === 0) return {};

    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('job_id,clicks')
      .in('job_id', jobIds);

    if (error) {
      throw new Error(`Failed to load click counts from Supabase: ${error.message}`);
    }

    const out: Record<string, number> = {};
    for (const id of jobIds) {
      out[id] = 0;
    }

    for (const row of (data ?? []) as ClickRow[]) {
      out[row.job_id] = normalizeCount(row.clicks);
    }

    return out;
  }

  async increment(jobId: string): Promise<number> {
    const run = this.queue.then(async () => {
      const { data, error } = await this.supabase.rpc('increment_job_click', {
        target_job_id: jobId
      });

      if (!error && typeof data === 'number') {
        return normalizeCount(data);
      }

      const next = (await this.get(jobId)) + 1;
      const { error: upsertError } = await this.supabase
        .from(this.tableName)
        .upsert({ job_id: jobId, clicks: next }, { onConflict: 'job_id' });

      if (upsertError) {
        const message = error ? `${error.message}; fallback failed: ${upsertError.message}` : upsertError.message;
        throw new Error(`Failed to increment click count in Supabase: ${message}`);
      }

      return next;
    });

    this.queue = run.then(() => undefined, () => undefined);
    return run;
  }
}
