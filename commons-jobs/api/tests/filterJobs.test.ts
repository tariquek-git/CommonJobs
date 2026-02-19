import { describe, expect, it } from 'vitest';
import { buildSearchFacets, filterPublicJobs } from '../src/services/filterJobs.js';
import { JobPosting } from '../src/types/jobs.js';

const now = Date.now();

const jobs: JobPosting[] = [
  {
    id: '1',
    companyName: 'Acme',
    companyWebsite: 'https://acme.com',
    roleTitle: 'Senior Engineer',
    externalLink: 'https://acme.com/jobs/1',
    postedDate: new Date(now - 1000).toISOString(),
    status: 'active',
    sourceType: 'Direct',
    isVerified: true,
    remotePolicy: 'Remote',
    employmentType: 'Full-time',
    seniority: 'Senior',
    tags: ['TypeScript'],
    clicks: 1
  },
  {
    id: '2',
    companyName: 'Beta',
    companyWebsite: 'https://beta.com',
    roleTitle: 'Product Manager',
    externalLink: 'https://beta.com/jobs/2',
    postedDate: new Date(now - 1000).toISOString(),
    status: 'pending',
    sourceType: 'Direct',
    isVerified: true,
    remotePolicy: 'Hybrid',
    employmentType: 'Full-time',
    seniority: 'Mid-Level',
    clicks: 0
  },
  {
    id: '3',
    companyName: 'Gamma',
    companyWebsite: 'https://gamma.com',
    roleTitle: 'Operations Analyst',
    externalLink: 'https://gamma.com/jobs/3',
    postedDate: new Date(now - 1000).toISOString(),
    status: 'active',
    sourceType: 'Direct',
    isVerified: true,
    clicks: 5
  }
];

describe('filterPublicJobs', () => {
  it('shows only active jobs for selected feed type', () => {
    const result = filterPublicJobs(
      jobs,
      {
        keyword: '',
        remotePolicies: [],
        seniorityLevels: [],
        employmentTypes: [],
        dateRange: 'all',
        locations: []
      },
      'direct'
    );

    expect(result).toHaveLength(2);
    expect(result.map((job) => job.id)).toContain('1');
    expect(result.map((job) => job.id)).toContain('3');
  });

  it('matches by keyword across title/company/tags', () => {
    const result = filterPublicJobs(
      jobs,
      {
        keyword: 'typescript',
        remotePolicies: [],
        seniorityLevels: [],
        employmentTypes: [],
        dateRange: 'all',
        locations: []
      },
      'direct'
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('excludes jobs with missing classified fields when filter is active', () => {
    const result = filterPublicJobs(
      jobs,
      {
        keyword: '',
        remotePolicies: ['Remote'],
        seniorityLevels: ['Senior'],
        employmentTypes: ['Full-time'],
        dateRange: 'all',
        locations: []
      },
      'direct'
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('supports sorting by click volume for direct feed', () => {
    const result = filterPublicJobs(
      jobs,
      {
        keyword: '',
        remotePolicies: [],
        seniorityLevels: [],
        employmentTypes: [],
        dateRange: 'all',
        locations: []
      },
      'direct',
      'most_clicked'
    );

    expect(result.map((job) => job.id)).toEqual(['3', '1']);
  });

  it('supports sorting alphabetically by company', () => {
    const result = filterPublicJobs(
      jobs,
      {
        keyword: '',
        remotePolicies: [],
        seniorityLevels: [],
        employmentTypes: [],
        dateRange: 'all',
        locations: []
      },
      'direct',
      'company_az'
    );

    expect(result.map((job) => job.companyName)).toEqual(['Acme', 'Gamma']);
  });

  it('builds facets for remote policy, employment type, and seniority', () => {
    const result = filterPublicJobs(
      jobs,
      {
        keyword: '',
        remotePolicies: [],
        seniorityLevels: [],
        employmentTypes: [],
        dateRange: 'all',
        locations: []
      },
      'direct'
    );

    const facets = buildSearchFacets(result);
    expect(facets.remotePolicies.Remote).toBe(1);
    expect(facets.remotePolicies.Hybrid).toBe(0);
    expect(facets.employmentTypes['Full-time']).toBe(1);
    expect(facets.seniorityLevels.Senior).toBe(1);
  });
});
