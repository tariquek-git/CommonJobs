import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';

const runtimeMock = vi.hoisted(() => ({
  createRuntimeContext: vi.fn(),
  stripApiPrefix: vi.fn((rawUrl?: string) => {
    if (!rawUrl) return '/';
    if (rawUrl === '/api' || rawUrl === '/api/') return '/';
    return rawUrl.startsWith('/api/') ? rawUrl.slice('/api'.length) : rawUrl;
  })
}));

vi.mock('../api/src/runtime.js', () => ({
  createRuntimeContext: runtimeMock.createRuntimeContext,
  stripApiPrefix: runtimeMock.stripApiPrefix
}));

const makeResponse = () => new EventEmitter();

describe('vercel API handler', () => {
  it('waits for Fastify response completion before resolving', async () => {
    const emit = vi.fn((_event: string, _req: unknown, res: EventEmitter) => {
      setTimeout(() => res.emit('finish'), 30);
      return true;
    });

    runtimeMock.createRuntimeContext.mockReturnValue({
      app: {
        ready: vi.fn().mockResolvedValue(undefined),
        server: { emit }
      }
    });

    const { default: handler } = await import('../vercel-api');

    const req = { url: '/api/jobs/search' } as unknown as IncomingMessage & { url?: string };
    const res = makeResponse() as unknown as ServerResponse;
    const startedAt = Date.now();

    await handler(req, res);

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(20);
    expect(req.url).toBe('/jobs/search');
    expect(emit).toHaveBeenCalledTimes(1);
  });
});
