import { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { AppEnv, parseEnv } from './config/env.js';
import { createRepositories } from './storage/repositoryFactory.js';

export type RuntimeContext = {
  app: FastifyInstance;
  env: AppEnv;
  provider: 'file' | 'supabase';
};

export const createRuntimeContext = (envInput: NodeJS.ProcessEnv = process.env): RuntimeContext => {
  const env = parseEnv(envInput);
  const { provider, repository, clickRepository } = createRepositories(env);
  const app = buildApp(repository, clickRepository, env);
  return { app, env, provider };
};

export const stripApiPrefix = (rawUrl?: string): string => {
  if (!rawUrl) return '/';

  const [path, query = ''] = rawUrl.split('?', 2);
  let normalizedPath = path;

  if (path === '/api' || path === '/api/') {
    normalizedPath = '/';
  } else if (path.startsWith('/api/')) {
    normalizedPath = path.slice('/api'.length) || '/';
  }

  return query ? `${normalizedPath}?${query}` : normalizedPath;
};
