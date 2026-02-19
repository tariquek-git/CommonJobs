import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { AppEnv } from '../config/env.js';
import { ClickRepository } from './clickRepository.js';
import { FileClickRepository } from './fileClickRepository.js';
import { FileJobRepository } from './fileJobRepository.js';
import { JobRepository } from './jobRepository.js';
import { SupabaseClickRepository } from './supabaseClickRepository.js';
import { SupabaseJobRepository } from './supabaseJobRepository.js';

export type RepositoryBundle = {
  provider: 'file' | 'supabase';
  repository: JobRepository;
  clickRepository: ClickRepository;
};

const normalizeKey = (value?: string): string => (typeof value === 'string' ? value.trim() : '');
const looksLikeSupabaseSecret = (value: string): boolean =>
  value.startsWith('sb_secret_') || value.startsWith('eyJ');

export const resolveSupabaseServiceKey = (
  configuredKey: string,
  envInput: NodeJS.ProcessEnv = process.env
): string => {
  const primary = normalizeKey(configuredKey);
  if (looksLikeSupabaseSecret(primary)) return primary;

  const legacyCandidates = [
    normalizeKey(envInput.SUPABASE_SECRET_KEY),
    normalizeKey(envInput.Vite_annon),
    normalizeKey(envInput.Vite)
  ];
  const fallback = legacyCandidates.find((candidate) => looksLikeSupabaseSecret(candidate));

  if (fallback) {
    return fallback;
  }

  return primary;
};

export const createRepositories = (env: AppEnv): RepositoryBundle => {
  if (env.STORAGE_PROVIDER === 'supabase') {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase storage provider selected but required credentials are missing');
    }

    const supabaseKey = resolveSupabaseServiceKey(env.SUPABASE_SERVICE_ROLE_KEY);

    const client = createClient(env.SUPABASE_URL, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    return {
      provider: 'supabase',
      repository: new SupabaseJobRepository(client, env.SUPABASE_JOBS_TABLE),
      clickRepository: new SupabaseClickRepository(client, env.SUPABASE_CLICKS_TABLE)
    };
  }

  return {
    provider: 'file',
    repository: new FileJobRepository(resolve(process.cwd(), env.DATA_FILE)),
    clickRepository: new FileClickRepository(resolve(process.cwd(), env.CLICK_DATA_FILE))
  };
};
