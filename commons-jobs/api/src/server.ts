import { buildApp } from './app.js';
import { parseEnv } from './config/env.js';
import { createRepositories } from './storage/repositoryFactory.js';

const env = parseEnv(process.env);
const { provider, repository, clickRepository } = createRepositories(env);
const app = buildApp(repository, clickRepository, env);

const start = async () => {
  try {
    await app.listen({ host: '0.0.0.0', port: env.PORT });
    app.log.info({ port: env.PORT, storageProvider: provider }, 'API listening');
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
