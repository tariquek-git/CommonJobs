import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv();

const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

const parseTrustProxy = (value: string): boolean | number => {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false' || normalized === '') return false;

  const numeric = Number(normalized);
  if (Number.isInteger(numeric) && numeric >= 0) {
    return numeric;
  }

  throw new Error('TRUST_PROXY must be "true", "false", or a non-negative integer');
};

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4010),
  DATA_FILE: z.string().default('data/jobs.json'),
  CLICK_DATA_FILE: z.string().default('data/clicks.json'),
  CLIENT_ORIGIN: z.string().default('http://localhost:3000,http://localhost:3010,http://localhost:5173'),
  ADMIN_USERNAME: z.string().trim().min(3).optional(),
  ADMIN_PASSWORD_HASH: z.string().trim().optional(),
  ADMIN_TOKEN_SECRET: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX_SUBMIT: z.coerce.number().default(20),
  RATE_LIMIT_MAX_ADMIN_LOGIN: z.coerce.number().default(30),
  RATE_LIMIT_MAX_CLICK: z.coerce.number().default(60),
  CLICK_DEDUPE_WINDOW_MS: z.coerce.number().default(60 * 1000),
  TRUST_PROXY: z.string().default('false').transform(parseTrustProxy)
});

export type AppEnv = z.infer<typeof envSchema>;

export const parseEnv = (input: NodeJS.ProcessEnv): AppEnv => {
  const parsed = envSchema.parse(input);
  const isTest = parsed.NODE_ENV === 'test';

  if (!isTest) {
    if (!parsed.ADMIN_USERNAME) {
      throw new Error('Missing required env: ADMIN_USERNAME');
    }
    if (!parsed.ADMIN_PASSWORD_HASH) {
      throw new Error('Missing required env: ADMIN_PASSWORD_HASH');
    }
    if (!BCRYPT_HASH_PATTERN.test(parsed.ADMIN_PASSWORD_HASH)) {
      throw new Error('ADMIN_PASSWORD_HASH must be a valid bcrypt hash');
    }
    if (!parsed.ADMIN_TOKEN_SECRET) {
      throw new Error('Missing required env: ADMIN_TOKEN_SECRET');
    }
    if (parsed.ADMIN_TOKEN_SECRET.length < 32) {
      throw new Error('ADMIN_TOKEN_SECRET must be at least 32 characters');
    }
  }

  return parsed;
};

export const parseAllowedOrigins = (clientOrigin: string): string[] => {
  return clientOrigin.split(',').map((origin) => origin.trim()).filter(Boolean);
};
