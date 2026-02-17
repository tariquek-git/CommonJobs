import { IncomingMessage, ServerResponse } from 'node:http';
import { createRuntimeContext, stripApiPrefix, type RuntimeContext } from './api/src/runtime.js';

let runtime: RuntimeContext | null = null;
let ready: PromiseLike<unknown> | null = null;

const getRuntime = (): { runtime: RuntimeContext; ready: PromiseLike<unknown> } => {
  if (!runtime || !ready) {
    runtime = createRuntimeContext(process.env);
    ready = runtime.app.ready();
  }
  return { runtime, ready };
};

const handler = async (
  req: IncomingMessage & { url?: string },
  res: ServerResponse
): Promise<void> => {
  req.url = stripApiPrefix(req.url);

  // In serverless, cold-start init can occasionally fail (transient env/network issues).
  // Retry once with a fresh Fastify instance to avoid a persistent first-request 500.
  const attempt = async () => {
    const ctx = getRuntime();
    await ctx.ready;
    ctx.runtime.app.server.emit('request', req, res);
  };

  try {
    await attempt();
  } catch (error) {
    console.error('Vercel API init/request failed, retrying once.', error);
    try {
      if (runtime) {
        await runtime.app.close();
      }
    } catch (closeError) {
      console.error('Failed to close previous Fastify instance after error.', closeError);
    } finally {
      runtime = null;
      ready = null;
    }

    await attempt();
  }
};

export default handler;
