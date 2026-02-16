import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FileClickRepository } from '../src/storage/fileClickRepository.js';
import { FileJobRepository } from '../src/storage/fileJobRepository.js';
import { JobPosting } from '../src/types/jobs.js';

const tempDirs: string[] = [];

const createTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'commons-jobs-api-'));
  tempDirs.push(dir);
  return dir;
};

const createBaseJob = (id: string): JobPosting => ({
  id,
  companyName: 'Acme',
  companyWebsite: 'https://example.com',
  roleTitle: 'Engineer',
  externalLink: 'https://example.com/apply',
  postedDate: new Date().toISOString(),
  status: 'active',
  sourceType: 'Direct',
  isVerified: true,
  clicks: 0
});

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('storage concurrency and click isolation', () => {
  it('serializes concurrent job mutations to avoid lost updates', async () => {
    const dir = await createTempDir();
    const repo = new FileJobRepository(join(dir, 'jobs.json'));
    await repo.mutate((jobs) => {
      jobs.splice(0, jobs.length, createBaseJob('seed'));
      return null;
    });

    await Promise.all(
      Array.from({ length: 20 }, (_, idx) =>
        repo.mutate(async (jobs) => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          jobs.push(createBaseJob(`job-${idx}`));
        })
      )
    );

    const jobs = await repo.list();
    expect(jobs).toHaveLength(21);
    expect(jobs.filter((job) => job.id.startsWith('job-'))).toHaveLength(20);
  });

  it('stores clicks separately so click writes do not rewrite jobs file', async () => {
    const dir = await createTempDir();
    const jobsPath = join(dir, 'jobs.json');
    const clicksPath = join(dir, 'clicks.json');
    const jobRepo = new FileJobRepository(jobsPath);
    const clickRepo = new FileClickRepository(clicksPath);

    await jobRepo.mutate((jobs) => {
      jobs.splice(0, jobs.length, createBaseJob('job-1'));
      return null;
    });

    const before = await readFile(jobsPath, 'utf8');
    await clickRepo.increment('job-1');
    await clickRepo.increment('job-1');
    const after = await readFile(jobsPath, 'utf8');

    expect(before).toBe(after);
    expect(await clickRepo.get('job-1')).toBe(2);
  });
});
