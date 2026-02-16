import { JobPosting } from '../types/jobs.js';

export interface JobRepository {
  list(): Promise<JobPosting[]>;
  replaceAll(jobs: JobPosting[]): Promise<void>;
}
