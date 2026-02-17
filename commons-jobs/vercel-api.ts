import { IncomingMessage, ServerResponse } from 'node:http';
import { createRuntimeContext, stripApiPrefix } from './api/src/runtime.js';

const { app } = createRuntimeContext(process.env);
const appReadyPromise = app.ready();

const handler = async (
  req: IncomingMessage & { url?: string },
  res: ServerResponse
): Promise<void> => {
  req.url = stripApiPrefix(req.url);
  await appReadyPromise;
  app.server.emit('request', req, res);
};

export default handler;
