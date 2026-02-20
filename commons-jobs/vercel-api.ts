import { IncomingMessage, ServerResponse } from 'node:http';
import { createRuntimeContext, stripApiPrefix, type RuntimeContext } from './api/src/runtime.js';

let runtime: RuntimeContext | null = null;
let ready: PromiseLike<unknown> | null = null;
const REQUEST_TIMEOUT_MS = 25_000;
const SAFE_RETRY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

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

const sendHandlerError = (res: ServerResponse) => {
  if (res.headersSent || res.writableEnded || res.destroyed) return;
  res.statusCode = 500;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: 'Internal server error' }));
};

const handler = async (req: IncomingMessage & { url?: string }, res: ServerResponse): Promise<void> => {
  req.url = stripApiPrefix(req.url);
  const method = (req.method || 'GET').toUpperCase();

  try {
    let ctx = getRuntime();
    try {
      await ctx.ready;
    } catch (error) {
      console.error('Vercel API init failed, retrying runtime initialization once.', error);
      try {
        if (runtime) {
          await runtime.app.close();
        }
      } catch (closeError) {
        console.error('Failed to close previous Fastify instance after init error.', closeError);
      } finally {
        runtime = null;
        ready = null;
      }

      ctx = getRuntime();
      await ctx.ready;
    }

    await forwardToFastify(req, res, ctx.runtime);
  } catch (error) {
    if (!SAFE_RETRY_METHODS.has(method)) {
      console.error(`Vercel API request failed without replay for unsafe method ${method}.`, error);
      sendHandlerError(res);
      return;
    }

    console.error(`Vercel API safe request failed for ${method}.`, error);
    if (res.headersSent || res.writableEnded || res.destroyed) {
      return;
    }

    try {
      if (runtime) {
        await runtime.app.close();
      }
    } catch (closeError) {
      console.error('Failed to close previous Fastify instance after safe-request error.', closeError);
    } finally {
      runtime = null;
      ready = null;
    }

    try {
      const retryCtx = getRuntime();
      await retryCtx.ready;
      await forwardToFastify(req, res, retryCtx.runtime);
    } catch (retryError) {
      console.error('Vercel API retry for safe request failed.', retryError);
      sendHandlerError(res);
    }
  }
};

export default handler;
