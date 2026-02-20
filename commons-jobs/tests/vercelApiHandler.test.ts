import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

const makeResponse = () => {
  const res = new EventEmitter() as EventEmitter &
    Partial<ServerResponse> & {
      statusCode: number;
      headersSent: boolean;
      writableEnded: boolean;
      destroyed: boolean;
      setHeader: ReturnType<typeof vi.fn>;
      end: ReturnType<typeof vi.fn>;
    };

  res.statusCode = 200;
  res.headersSent = false;
  res.writableEnded = false;
  res.destroyed = false;
  res.setHeader = vi.fn();
  res.end = vi.fn(() => {
    res.writableEnded = true;
    res.emit('finish');
    return res as unknown as ServerResponse;
  });
  return res as unknown as ServerResponse;
};

describe('vercel API handler', () => {
  beforeEach(() => {
    vi.resetModules();
    runtimeMock.createRuntimeContext.mockReset();
    runtimeMock.stripApiPrefix.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits for Fastify response completion before resolving', async () => {
    const emit = vi.fn((_event: string, _req: unknown, res: EventEmitter) => {
      setTimeout(() => res.emit('finish'), 30);
      return true;
    });

    runtimeMock.createRuntimeContext.mockReturnValue({
      app: {
        ready: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
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

  it('does not retry timed-out non-idempotent requests', async () => {
    vi.useFakeTimers();

    const emit = vi.fn(() => true);
    runtimeMock.createRuntimeContext.mockReturnValue({
      app: {
        ready: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        server: { emit }
      }
    });

    const { default: handler } = await import('../vercel-api');
    const req = { method: 'POST', url: '/api/jobs/submissions' } as unknown as IncomingMessage & { url?: string };
    const res = makeResponse() as unknown as ServerResponse;
    const pending = handler(req, res);

    await vi.advanceTimersByTimeAsync(25_050);
    await expect(pending).resolves.toBeUndefined();
    expect((res as unknown as { statusCode: number }).statusCode).toBe(500);
    expect(runtimeMock.createRuntimeContext).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('retries timed-out safe GET requests once', async () => {
    vi.useFakeTimers();

    const firstEmit = vi.fn(() => true);
    const secondEmit = vi.fn((_event: string, _req: unknown, res: EventEmitter) => {
      setTimeout(() => res.emit('finish'), 1);
      return true;
    });
    const firstClose = vi.fn().mockResolvedValue(undefined);

    runtimeMock.createRuntimeContext
      .mockReturnValueOnce({
        app: {
          ready: vi.fn().mockResolvedValue(undefined),
          close: firstClose,
          server: { emit: firstEmit }
        }
      })
      .mockReturnValueOnce({
        app: {
          ready: vi.fn().mockResolvedValue(undefined),
          close: vi.fn().mockResolvedValue(undefined),
          server: { emit: secondEmit }
        }
      });

    const { default: handler } = await import('../vercel-api');
    const req = { method: 'GET', url: '/api/jobs/search' } as unknown as IncomingMessage & { url?: string };
    const res = makeResponse() as unknown as ServerResponse;
    const pending = handler(req, res);

    await vi.advanceTimersByTimeAsync(25_050);
    await vi.advanceTimersByTimeAsync(20);
    await expect(pending).resolves.toBeUndefined();
    expect(req.url).toBe('/jobs/search');
    expect(runtimeMock.createRuntimeContext).toHaveBeenCalledTimes(2);
    expect(firstEmit).toHaveBeenCalledTimes(1);
    expect(secondEmit).toHaveBeenCalledTimes(1);
    expect(firstClose).toHaveBeenCalledTimes(1);
  });

  it('retries runtime initialization failures once before forwarding request', async () => {
    const firstReady = vi.fn().mockRejectedValue(new Error('init failed'));
    const firstEmit = vi.fn();
    const firstClose = vi.fn().mockResolvedValue(undefined);

    const secondReady = vi.fn().mockResolvedValue(undefined);
    const secondEmit = vi.fn((_event: string, _req: unknown, res: EventEmitter) => {
      setTimeout(() => res.emit('finish'), 0);
      return true;
    });

    runtimeMock.createRuntimeContext
      .mockReturnValueOnce({
        app: {
          ready: firstReady,
          close: firstClose,
          server: { emit: firstEmit }
        }
      })
      .mockReturnValueOnce({
        app: {
          ready: secondReady,
          close: vi.fn().mockResolvedValue(undefined),
          server: { emit: secondEmit }
        }
      });

    const { default: handler } = await import('../vercel-api');
    const req = { method: 'POST', url: '/api/jobs/submissions' } as unknown as IncomingMessage & { url?: string };
    const res = makeResponse() as unknown as ServerResponse;

    await handler(req, res);

    expect(runtimeMock.createRuntimeContext).toHaveBeenCalledTimes(2);
    expect(firstEmit).toHaveBeenCalledTimes(0);
    expect(secondEmit).toHaveBeenCalledTimes(1);
    expect(firstClose).toHaveBeenCalledTimes(1);
  });
});
