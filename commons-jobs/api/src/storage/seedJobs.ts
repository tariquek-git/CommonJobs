import { JobPosting } from '../types/jobs.js';

const now = Date.now();

export const seedJobs: JobPosting[] = [
  {
    id: 'seed-1',
    companyName: 'Stripe',
    companyWebsite: 'https://stripe.com',
    roleTitle: 'Senior Backend Engineer, Payments',
    externalLink: 'https://stripe.com/jobs',
    postedDate: new Date(now - 1000 * 60 * 60 * 3).toISOString(),
    status: 'active',
    sourceType: 'Direct',
    isVerified: true,
    externalSource: 'Direct',
    locationCity: 'San Francisco',
    locationState: 'CA',
    locationCountry: 'United States',
    remotePolicy: 'Hybrid',
    employmentType: 'Full-time',
    seniority: 'Senior',
    salaryRange: '180,000 - 240,000',
    currency: 'USD',
    intelligenceSummary: 'Join the payments core team and build high-throughput systems.',
    tags: ['Go', 'Distributed Systems'],
    clicks: 0
  },
  {
    id: 'seed-2',
    companyName: 'Wealthsimple',
    companyWebsite: 'https://wealthsimple.com',
    roleTitle: 'Staff Software Engineer, Crypto',
    externalLink: 'https://wealthsimple.com/careers',
    postedDate: new Date(now - 1000 * 60 * 60 * 24).toISOString(),
    status: 'active',
    sourceType: 'Aggregated',
    isVerified: false,
    externalSource: 'Manual Web Import',
    locationCity: 'Toronto',
    locationState: 'Ontario',
    locationCountry: 'Canada',
    remotePolicy: 'Hybrid',
    employmentType: 'Full-time',
    seniority: 'Senior',
    salaryRange: '160,000 - 210,000',
    currency: 'CAD',
    intelligenceSummary: 'Lead architecture for the crypto platform with a security focus.',
    tags: ['Blockchain', 'Security'],
    clicks: 0
  }
];
