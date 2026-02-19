import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/config/env.js';
import { createRepositories, resolveSupabaseServiceKey } from '../src/storage/repositoryFactory.js';
import { FileClickRepository } from '../src/storage/fileClickRepository.js';
import { FileJobRepository } from '../src/storage/fileJobRepository.js';
import { SupabaseClickRepository } from '../src/storage/supabaseClickRepository.js';
import { SupabaseJobRepository } from '../src/storage/supabaseJobRepository.js';

const baseEnv = {
  NODE_ENV: 'test',
  PORT: '4010',
  STORAGE_PROVIDER: 'file',
  DATA_FILE: 'data/jobs.json',
  CLICK_DATA_FILE: 'data/clicks.json',
  SUPABASE_JOBS_TABLE: 'job_board_jobs',
  SUPABASE_CLICKS_TABLE: 'job_board_clicks',
  CLIENT_ORIGIN: 'http://localhost:5173',
  RATE_LIMIT_WINDOW_MS: '900000',
  RATE_LIMIT_MAX_SUBMIT: '20',
  RATE_LIMIT_MAX_ADMIN_LOGIN: '30',
  RATE_LIMIT_MAX_CLICK: '60',
  CLICK_DEDUPE_WINDOW_MS: '60000',
  TRUST_PROXY: 'false'
};

describe('repositoryFactory', () => {
  it('builds file repositories by default', () => {
    const env = parseEnv(baseEnv);
    const repos = createRepositories(env);

    expect(repos.provider).toBe('file');
    expect(repos.repository).toBeInstanceOf(FileJobRepository);
    expect(repos.clickRepository).toBeInstanceOf(FileClickRepository);
  });

  it('builds Supabase repositories when selected', () => {
    const env = parseEnv({
      ...baseEnv,
      STORAGE_PROVIDER: 'supabase',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key'
    });
    const repos = createRepositories(env);

    expect(repos.provider).toBe('supabase');
    expect(repos.repository).toBeInstanceOf(SupabaseJobRepository);
    expect(repos.clickRepository).toBeInstanceOf(SupabaseClickRepository);
  });

  it('uses legacy secret fallback when configured key is a placeholder', () => {
    const key = resolveSupabaseServiceKey('rotate-me', {
      Vite_annon: 'sb_secret_fallback'
    } as NodeJS.ProcessEnv);

    expect(key).toBe('sb_secret_fallback');
  });

  it('keeps configured key when it already looks like a Supabase secret', () => {
    const key = resolveSupabaseServiceKey('sb_secret_primary', {
      Vite_annon: 'sb_secret_fallback'
    } as NodeJS.ProcessEnv);

    expect(key).toBe('sb_secret_primary');
  });
});
