export type RemotePolicy = 'Onsite' | 'Hybrid' | 'Remote';
export type EmploymentType = 'Full-time' | 'Contract' | 'Internship';
export type SeniorityLevel = 'Junior' | 'Mid-Level' | 'Senior' | 'Lead' | 'Executive';
export type JobSourceType = 'Direct' | 'Aggregated';
export type JobStatus = 'pending' | 'active' | 'rejected' | 'archived';

export interface JobPosting {
  id: string;
  companyName: string;
  companyWebsite: string;
  roleTitle: string;
  externalLink: string;
  postedDate: string;
  status: JobStatus;
  sourceType: JobSourceType;
  isVerified: boolean;
  externalSource?: string;
  intelligenceSummary?: string;
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  region?: string;
  remotePolicy?: RemotePolicy;
  employmentType?: EmploymentType;
  seniority?: SeniorityLevel;
  salaryRange?: string;
  currency?: string;
  tags?: string[];
  submitterName?: string;
  submitterEmail?: string;
  clicks: number;
}

export interface JobFilterState {
  keyword: string;
  remotePolicies: RemotePolicy[];
  seniorityLevels: SeniorityLevel[];
  employmentTypes: EmploymentType[];
  dateRange: 'all' | '24h' | '7d' | '30d';
  locations: string[];
}
