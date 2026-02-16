import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv();

const DEFAULT_ADMIN_PASSWORD = 'admin12345';
const DEFAULT_ADMIN_TOKEN_SECRET = 'change-me-super-secret-please';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4010),
  DATA_FILE: z.string().default('data/jobs.json'),
  CLIENT_ORIGIN: z.string().default('http://localhost:3000,http://localhost:3010,http://localhost:5173'),
  ADMIN_PASSWORD: z.string().min(8).default(DEFAULT_ADMIN_PASSWORD),
  ADMIN_TOKEN_SECRET: z.string().min(16).default(DEFAULT_ADMIN_TOKEN_SECRET),
  GEMINI_API_KEY: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX_SUBMIT: z.coerce.number().default(20),
  RATE_LIMIT_MAX_ADMIN_LOGIN: z.coerce.number().default(30)
});

export type AppEnv = z.infer<typeof envSchema>;

export const parseEnv = (input: NodeJS.ProcessEnv): AppEnv => {
  const parsed = envSchema.parse(input);

  if (parsed.NODE_ENV === 'production') {
    if (parsed.ADMIN_PASSWORD === DEFAULT_ADMIN_PASSWORD) {
      throw new Error('ADMIN_PASSWORD must be set to a non-default value in production');
    }

    if (parsed.ADMIN_TOKEN_SECRET === DEFAULT_ADMIN_TOKEN_SECRET) {
      throw new Error('ADMIN_TOKEN_SECRET must be set to a non-default value in production');
    }
  }

  return parsed;
};

export const env = parseEnv(process.env);

export const allowedOrigins = env.CLIENT_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean);
