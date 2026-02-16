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

export const createRepositories = (env: AppEnv): RepositoryBundle => {
  if (env.STORAGE_PROVIDER === 'supabase') {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase storage provider selected but required credentials are missing');
    }

    const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
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
