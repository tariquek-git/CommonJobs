import { JobRepository } from './jobRepository.js';
import { JobPosting } from '../types/jobs.js';
import { seedJobs } from './seedJobs.js';

const cloneJob = (job: JobPosting): JobPosting => ({
  ...job,
  tags: job.tags ? [...job.tags] : undefined
});

export class InMemoryJobRepository implements JobRepository {
  private jobs: JobPosting[];
  private queue: Promise<void> = Promise.resolve();

  constructor(initialJobs?: JobPosting[]) {
    this.jobs = initialJobs ? initialJobs.map(cloneJob) : seedJobs.map(cloneJob);
  }

  async list(): Promise<JobPosting[]> {
    return this.jobs.map(cloneJob);
  }

  async mutate<T>(mutator: (jobs: JobPosting[]) => Promise<T> | T): Promise<T> {
    const run = this.queue.then(async () => {
      const workingCopy = this.jobs.map(cloneJob);
      const result = await mutator(workingCopy);
      this.jobs = workingCopy;
      return result;
    });

    this.queue = run.then(() => undefined, () => undefined);
    return run;
  }
}
