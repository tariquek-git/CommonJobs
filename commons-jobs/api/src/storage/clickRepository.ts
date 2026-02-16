export interface ClickRepository {
  get(jobId: string): Promise<number>;
  getMany(jobIds: string[]): Promise<Record<string, number>>;
  increment(jobId: string): Promise<number>;
}
