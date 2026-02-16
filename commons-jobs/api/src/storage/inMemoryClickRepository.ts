import { ClickRepository } from './clickRepository.js';

export class InMemoryClickRepository implements ClickRepository {
  private readonly clicks = new Map<string, number>();

  constructor(initialCounts?: Record<string, number>) {
    if (initialCounts) {
      for (const [jobId, count] of Object.entries(initialCounts)) {
        this.clicks.set(jobId, count);
      }
    }
  }

  async get(jobId: string): Promise<number> {
    return this.clicks.get(jobId) || 0;
  }

  async getMany(jobIds: string[]): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const id of jobIds) {
      out[id] = this.clicks.get(id) || 0;
    }
    return out;
  }

  async increment(jobId: string): Promise<number> {
    const next = (this.clicks.get(jobId) || 0) + 1;
    this.clicks.set(jobId, next);
    return next;
  }
}
