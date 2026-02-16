import { JobRepository } from './jobRepository.js';
import { JobPosting } from '../types/jobs.js';
import { seedJobs } from './seedJobs.js';

export class InMemoryJobRepository implements JobRepository {
  private jobs: JobPosting[];

  constructor(initialJobs?: JobPosting[]) {
    this.jobs = initialJobs ? [...initialJobs] : [...seedJobs];
  }

  async list(): Promise<JobPosting[]> {
    return [...this.jobs];
  }

  async replaceAll(jobs: JobPosting[]): Promise<void> {
    this.jobs = [...jobs];
  }
}
