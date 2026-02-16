import { resolve } from 'node:path';
import { buildApp } from './app.js';
import { parseEnv } from './config/env.js';
import { FileJobRepository } from './storage/fileJobRepository.js';

const env = parseEnv(process.env);
const repository = new FileJobRepository(resolve(process.cwd(), env.DATA_FILE));
const app = buildApp(repository, env);

const start = async () => {
  try {
    await app.listen({ host: '0.0.0.0', port: env.PORT });
    app.log.info(`API listening on port ${env.PORT}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
