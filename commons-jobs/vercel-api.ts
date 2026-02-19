import { IncomingMessage, ServerResponse } from 'node:http';
import { createRuntimeContext, stripApiPrefix, type RuntimeContext } from './api/src/runtime.js';

let runtime: RuntimeContext | null = null;
let ready: PromiseLike<unknown> | null = null;
const REQUEST_TIMEOUT_MS = 25_000;

const getRuntime = (): { runtime: RuntimeContext; ready: PromiseLike<unknown> } => {
  if (!runtime || !ready) {
    runtime = createRuntimeContext(process.env);
    ready = runtime.app.ready();
  }
  return { runtime, ready };
};

const forwardToFastify = async (
  req: IncomingMessage & { url?: string },
  res: ServerResponse,
  ctx: RuntimeContext
): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Fastify response timed out after ${REQUEST_TIMEOUT_MS}ms`));
    }, REQUEST_TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(timeout);
      res.off('finish', onFinish);
      res.off('close', onClose);
      res.off('error', onError);
    };

    const onFinish = () => {
      cleanup();
      resolve();
    };

    const onClose = () => {
      cleanup();
      resolve();
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    res.once('finish', onFinish);
    res.once('close', onClose);
    res.once('error', onError);

    ctx.app.server.emit('request', req, res);
  });
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
    await forwardToFastify(req, res, ctx.runtime);
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
