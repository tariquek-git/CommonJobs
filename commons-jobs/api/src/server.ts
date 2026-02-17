import { createRuntimeContext } from './runtime.js';

const { app, env, provider } = createRuntimeContext(process.env);

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
