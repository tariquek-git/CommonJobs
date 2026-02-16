import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { JobRepository } from './jobRepository.js';
import { JobPosting } from '../types/jobs.js';
import { seedJobs } from './seedJobs.js';

export class FileJobRepository implements JobRepository {
  private readonly filePath: string;
  private readonly tempPath: string;

  constructor(filePath: string) {
    this.filePath = resolve(filePath);
    this.tempPath = `${this.filePath}.tmp`;
  }

  async list(): Promise<JobPosting[]> {
    try {
      const data = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(data) as JobPosting[];
      if (!Array.isArray(parsed)) return seedJobs;
      return parsed;
    } catch {
      await this.replaceAll(seedJobs);
      return [...seedJobs];
    }
  }

  async replaceAll(jobs: JobPosting[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const payload = JSON.stringify(jobs, null, 2);
    await writeFile(this.tempPath, payload, 'utf8');
    await rename(this.tempPath, this.filePath);
  }
}
