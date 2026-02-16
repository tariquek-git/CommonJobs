
import { EmploymentType, JobPosting, RemotePolicy, SeniorityLevel } from './types';

export const MOCK_JOBS: JobPosting[] = [
  {
    id: '1',
    companyName: 'Stripe',
    companyWebsite: 'https://stripe.com',
    roleTitle: 'Senior Backend Engineer, Payments',
    externalLink: 'https://stripe.com/jobs',
    postedDate: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    status: 'active',
    sourceType: 'Direct',
    isVerified: true,
    externalSource: 'Direct',
    locationCity: 'San Francisco',
    locationState: 'CA',
    locationCountry: 'United States',
    region: 'North America',
    remotePolicy: RemotePolicy.HYBRID,
    employmentType: EmploymentType.FULL_TIME,
    seniority: SeniorityLevel.SENIOR,
    salaryRange: '180,000 - 240,000',
    currency: 'USD',
    intelligenceSummary: 'Join the core payments infrastructure team. Work on high-throughput systems processing billions of dollars daily. Requires strong Go experience and distributed systems knowledge.',
    tags: ['Go', 'Distributed Systems', 'API'],
    clicks: 142,
    submitterName: 'John Doe',
    submitterEmail: 'john@example.com'
  },
  {
    id: '2',
    companyName: 'Revolut',
    companyWebsite: 'https://revolut.com',
    roleTitle: 'Head of AML Compliance',
    externalLink: 'https://revolut.com/careers',
    postedDate: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 hours ago
    status: 'active',
    sourceType: 'Direct',
    isVerified: true,
    externalSource: 'Direct',
    locationCity: 'London',
    locationCountry: 'Europe',
    region: 'Europe',
    remotePolicy: RemotePolicy.ONSITE,
    employmentType: EmploymentType.FULL_TIME,
    seniority: SeniorityLevel.LEAD,
    intelligenceSummary: 'Lead the global AML strategy and ensure regulatory compliance across 30+ markets. You will manage a team of 50+ compliance officers. Significant experience with FCA regulations is mandatory.',
    tags: ['FCA', 'Regulatory', 'Management'],
    clicks: 56,
    submitterName: 'Sarah Smith',
    submitterEmail: 'sarah.smith@revolut.com'
  },
  {
    id: '5',
    companyName: 'Plaid',
    companyWebsite: 'https://plaid.com',
    roleTitle: 'Partner Engineer',
    externalLink: 'https://plaid.com/careers',
    postedDate: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    status: 'active',
    sourceType: 'Direct',
    isVerified: true,
    externalSource: 'Direct',
    region: 'Remote',
    remotePolicy: RemotePolicy.REMOTE,
    employmentType: EmploymentType.FULL_TIME,
    seniority: SeniorityLevel.SENIOR,
    intelligenceSummary: 'Bridge the gap between technical integration and business partnerships. You will help major financial institutions integrate Plaid APIs. 50% coding, 50% client facing.',
    clicks: 67,
    submitterName: 'Tech Lead',
    submitterEmail: 'lead@plaid.com'
  }
];

// Canadian Fintech Aggregator Mocks
export const AGGREGATED_CANADIAN_JOBS: JobPosting[] = [
    {
        id: 'agg-1',
        companyName: 'Wealthsimple',
        companyWebsite: 'https://wealthsimple.com',
        roleTitle: 'Staff Software Engineer, Crypto',
        externalLink: 'https://wealthsimple.com/careers',
        postedDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(), // 1 day ago
        status: 'active',
        sourceType: 'Aggregated',
        isVerified: false,
        externalSource: 'Workday Scraper',
        locationCity: 'Toronto',
        locationState: 'Ontario',
        locationCountry: 'Canada',
        remotePolicy: RemotePolicy.HYBRID,
        employmentType: EmploymentType.FULL_TIME,
        seniority: SeniorityLevel.SENIOR,
        salaryRange: '160,000 - 210,000',
        currency: 'CAD',
        intelligenceSummary: 'Lead architectural decisions for the Crypto trading platform. Focus on cold storage security and ledger reconciliation. High visibility role in a regulated environment.',
        tags: ['Blockchain', 'Security', 'Typescript'],
        clicks: 12
    },
    {
        id: 'agg-2',
        companyName: 'Neo Financial',
        companyWebsite: 'https://neofinancial.com',
        roleTitle: 'Product Manager, Credit Cards',
        externalLink: 'https://neofinancial.com/careers',
        postedDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), // 3 days ago
        status: 'active',
        sourceType: 'Aggregated',
        isVerified: false,
        externalSource: 'LinkedIn Scraper',
        locationCity: 'Calgary',
        locationState: 'Alberta',
        locationCountry: 'Canada',
        remotePolicy: RemotePolicy.ONSITE,
        employmentType: EmploymentType.FULL_TIME,
        seniority: SeniorityLevel.MID,
        intelligenceSummary: 'Own the roadmap for the core credit card product. Work with engineering and risk teams to launch new reward features. Requires strong SQL and product analytics skills.',
        tags: ['Product', 'Credit', 'SQL'],
        clicks: 8
    },
    {
        id: 'agg-3',
        companyName: 'RBC',
        companyWebsite: 'https://rbc.com',
        roleTitle: 'DevOps Engineer, Cloud Platform',
        externalLink: 'https://jobs.rbc.com',
        postedDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(), // 5 days ago
        status: 'active',
        sourceType: 'Aggregated',
        isVerified: false,
        externalSource: 'Bank Careers Page',
        locationCity: 'Toronto',
        locationState: 'Ontario',
        locationCountry: 'Canada',
        remotePolicy: RemotePolicy.HYBRID,
        employmentType: EmploymentType.CONTRACT,
        seniority: SeniorityLevel.MID,
        intelligenceSummary: 'Modernize the banks cloud infrastructure on Azure. Build CI/CD pipelines for 500+ developers. Focus on security compliance and automation.',
        tags: ['Azure', 'Kubernetes', 'Terraform'],
        clicks: 5
    },
    {
        id: 'agg-4',
        companyName: 'Koho',
        companyWebsite: 'https://koho.ca',
        roleTitle: 'Data Scientist, Credit Risk',
        externalLink: 'https://koho.ca/careers',
        postedDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 0.5).toISOString(), // 12 hours ago
        status: 'active',
        sourceType: 'Aggregated',
        isVerified: false,
        externalSource: 'Lever Scraper',
        locationCity: 'Remote',
        locationState: 'Canada',
        locationCountry: 'Canada',
        remotePolicy: RemotePolicy.REMOTE,
        employmentType: EmploymentType.FULL_TIME,
        seniority: SeniorityLevel.SENIOR,
        intelligenceSummary: 'Build machine learning models to predict credit default and optimize lending limits. Work with a massive transactional dataset.',
        tags: ['Python', 'ML', 'Credit Risk'],
        clicks: 42
    },
    {
        id: 'agg-5',
        companyName: 'Clearco',
        companyWebsite: 'https://clear.co',
        roleTitle: 'Frontend Developer',
        externalLink: 'https://clear.co/careers',
        postedDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(), // 10 days ago
        status: 'active',
        sourceType: 'Aggregated',
        isVerified: false,
        externalSource: 'Greenhouse Scraper',
        locationCity: 'Toronto',
        locationState: 'Ontario',
        locationCountry: 'Canada',
        remotePolicy: RemotePolicy.HYBRID,
        employmentType: EmploymentType.FULL_TIME,
        seniority: SeniorityLevel.JUNIOR,
        intelligenceSummary: 'Build merchant-facing dashboards for e-commerce funding. specialized in Vue.js and component library maintenance.',
        tags: ['Vue.js', 'Frontend', 'Dashboard'],
        clicks: 15
    }
];

export const REGIONS = ['North America', 'Europe', 'APAC', 'LATAM', 'Remote Global'];

// Location Data
export const COUNTRIES = ['Canada', 'United States', 'Europe', 'Rest of World'];

export const PROVINCES: Record<string, string[]> = {
  'Canada': [
    'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador',
    'Northwest Territories', 'Nova Scotia', 'Nunavut', 'Ontario', 'Prince Edward Island',
    'Quebec', 'Saskatchewan', 'Yukon'
  ],
  'United States': [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
    'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
    'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
    'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
    'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
    'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
    'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
    'Wisconsin', 'Wyoming'
  ],
  'Europe': [],
  'Rest of World': []
};

export const MAJOR_CITIES = [
  // Canada
  'Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa', 'Waterloo',
  // US
  'New York', 'San Francisco', 'San Jose', 'Austin', 'Chicago', 'Boston', 'Seattle', 'Los Angeles', 'Miami', 'Charlotte',
  // Europe
  'London', 'Berlin', 'Amsterdam', 'Paris', 'Dublin', 'Stockholm', 'Tallinn', 'Vilnius',
  // ROW
  'Singapore', 'Sydney', 'Dubai', 'Sao Paulo', 'Bangalore'
];
