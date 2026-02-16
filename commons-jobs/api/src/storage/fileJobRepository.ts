import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { JobRepository } from './jobRepository.js';
import { JobPosting } from '../types/jobs.js';
import { seedJobs } from './seedJobs.js';

const cloneJob = (job: JobPosting): JobPosting => ({
  ...job,
  tags: job.tags ? [...job.tags] : undefined
});

export class FileJobRepository implements JobRepository {
  private readonly filePath: string;
  private readonly tempPath: string;
  private queue: Promise<void> = Promise.resolve();

  constructor(filePath: string) {
    this.filePath = resolve(filePath);
    this.tempPath = `${this.filePath}.tmp`;
  }

  private async loadJobsFromDisk(): Promise<JobPosting[]> {
    try {
      const data = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(data) as JobPosting[];
      if (!Array.isArray(parsed)) return seedJobs.map(cloneJob);
      return parsed.map(cloneJob);
    } catch {
      await this.writeJobs(seedJobs);
      return seedJobs.map(cloneJob);
    }
  }

  private async writeJobs(jobs: JobPosting[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const payload = JSON.stringify(jobs, null, 2);
    await writeFile(this.tempPath, payload, 'utf8');
    await rename(this.tempPath, this.filePath);
  }

  async list(): Promise<JobPosting[]> {
    return this.loadJobsFromDisk();
  }

  async mutate<T>(mutator: (jobs: JobPosting[]) => Promise<T> | T): Promise<T> {
    const run = this.queue.then(async () => {
      const jobs = await this.loadJobsFromDisk();
      const result = await mutator(jobs);
      await this.writeJobs(jobs);
      return result;
    });

    this.queue = run.then(() => undefined, () => undefined);
    return run;
  }
}
