import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/config/env.js';

const baseEnv = {
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

describe('parseEnv', () => {
  it('fails fast when required admin env vars are missing outside test mode', () => {
    expect(() =>
      parseEnv({
        ...baseEnv,
        NODE_ENV: 'development'
      })
    ).toThrow('Missing required env: ADMIN_USERNAME');
  });

  it('accepts secure non-test configuration', () => {
    const parsed = parseEnv({
      ...baseEnv,
      NODE_ENV: 'production',
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD_HASH: '$2b$12$8ezX6T9YdxM0n7f4Lh8R4ecTBh7vASVSI04tef7KxN6wYV6Fjt24S',
      ADMIN_TOKEN_SECRET: 'super-long-token-secret-for-production-2026'
    });

    expect(parsed.NODE_ENV).toBe('production');
    expect(parsed.ADMIN_USERNAME).toBe('admin');
  });

  it('allows missing admin env vars in test mode', () => {
    const parsed = parseEnv({
      ...baseEnv,
      NODE_ENV: 'test'
    });

    expect(parsed.NODE_ENV).toBe('test');
  });

  it('rejects invalid trust proxy values', () => {
    expect(() =>
      parseEnv({
        ...baseEnv,
        NODE_ENV: 'test',
        TRUST_PROXY: 'foo'
      })
    ).toThrow('TRUST_PROXY must be "true", "false", or a non-negative integer');
  });

  it('requires SUPABASE_URL when Supabase storage is selected', () => {
    expect(() =>
      parseEnv({
        ...baseEnv,
        NODE_ENV: 'production',
        STORAGE_PROVIDER: 'supabase',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
        ADMIN_USERNAME: 'admin',
        ADMIN_PASSWORD_HASH: '$2b$12$8ezX6T9YdxM0n7f4Lh8R4ecTBh7vASVSI04tef7KxN6wYV6Fjt24S',
        ADMIN_TOKEN_SECRET: 'super-long-token-secret-for-production-2026'
      })
    ).toThrow('Missing required env for Supabase storage: SUPABASE_URL');
  });

  it('requires SUPABASE_SERVICE_ROLE_KEY when Supabase storage is selected', () => {
    expect(() =>
      parseEnv({
        ...baseEnv,
        NODE_ENV: 'production',
        STORAGE_PROVIDER: 'supabase',
        SUPABASE_URL: 'https://example.supabase.co',
        ADMIN_USERNAME: 'admin',
        ADMIN_PASSWORD_HASH: '$2b$12$8ezX6T9YdxM0n7f4Lh8R4ecTBh7vASVSI04tef7KxN6wYV6Fjt24S',
        ADMIN_TOKEN_SECRET: 'super-long-token-secret-for-production-2026'
      })
    ).toThrow('Missing required env for Supabase storage: SUPABASE_SERVICE_ROLE_KEY');
  });
});
