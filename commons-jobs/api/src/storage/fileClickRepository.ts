import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { ClickRepository } from './clickRepository.js';

type ClickStore = Record<string, number>;

const normalizeStore = (input: unknown): ClickStore => {
  if (!input || typeof input !== 'object') return {};
  const out: ClickStore = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      out[key] = Math.floor(value);
    }
  }
  return out;
};

export class FileClickRepository implements ClickRepository {
  private readonly filePath: string;
  private readonly tempPath: string;
  private queue: Promise<void> = Promise.resolve();

  constructor(filePath: string) {
    this.filePath = resolve(filePath);
    this.tempPath = `${this.filePath}.tmp`;
  }

  private async readStore(): Promise<ClickStore> {
    try {
      const data = await readFile(this.filePath, 'utf8');
      return normalizeStore(JSON.parse(data));
    } catch {
      return {};
    }
  }

  private async writeStore(store: ClickStore): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const payload = JSON.stringify(store, null, 2);
    await writeFile(this.tempPath, payload, 'utf8');
    await rename(this.tempPath, this.filePath);
  }

  async get(jobId: string): Promise<number> {
    const store = await this.readStore();
    return store[jobId] || 0;
  }

  async getMany(jobIds: string[]): Promise<Record<string, number>> {
    const store = await this.readStore();
    const out: Record<string, number> = {};
    for (const jobId of jobIds) {
      out[jobId] = store[jobId] || 0;
    }
    return out;
  }

  async increment(jobId: string): Promise<number> {
    const run = this.queue.then(async () => {
      const store = await this.readStore();
      const next = (store[jobId] || 0) + 1;
      store[jobId] = next;
      await this.writeStore(store);
      return next;
    });

    this.queue = run.then(() => undefined, () => undefined);
    return run;
  }
}
