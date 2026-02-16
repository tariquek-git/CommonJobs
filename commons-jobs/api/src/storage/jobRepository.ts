import { JobPosting } from '../types/jobs.js';

export interface JobRepository {
  list(): Promise<JobPosting[]>;
  mutate<T>(mutator: (jobs: JobPosting[]) => Promise<T> | T): Promise<T>;
}
