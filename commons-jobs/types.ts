
export enum RemotePolicy {
  ONSITE = 'Onsite',
  HYBRID = 'Hybrid',
  REMOTE = 'Remote'
}

export enum EmploymentType {
  FULL_TIME = 'Full-time',
  CONTRACT = 'Contract',
  INTERNSHIP = 'Internship'
}

export enum SeniorityLevel {
  JUNIOR = 'Junior',
  MID = 'Mid-Level',
  SENIOR = 'Senior',
  LEAD = 'Lead',
  EXECUTIVE = 'Executive'
}

export type JobSourceType = 'Direct' | 'Aggregated';
export type JobStatus = 'pending' | 'active' | 'rejected' | 'archived';

export interface JobPosting {
  id: string;
  companyName: string;
  companyWebsite: string;
  roleTitle: string;
  externalLink: string;
  postedDate: string; // ISO String
  status: JobStatus;
  
  // Mercor Specific Fields
  sourceType: JobSourceType;
  isVerified: boolean; // Default true for Direct
  externalSource?: string; // e.g. LinkedIn, Workday
  intelligenceSummary?: string; // AI Generated 3-sentence summary
  
  // Standard Fields
  locationCity?: string;
  locationState?: string; // Province or State
  locationCountry?: string;
  region?: string;
  remotePolicy?: RemotePolicy;
  employmentType?: EmploymentType;
  seniority?: SeniorityLevel;
  salaryRange?: string;
  currency?: string;
  tags?: string[];
  
  // Submitter Info (Private/Admin only)
  submitterName?: string;
  submitterEmail?: string;
  
  // Analytics
  clicks: number;
}

export type DateRangeOption = 'all' | '24h' | '7d' | '30d';

export interface JobFilterState {
  keyword: string;
  remotePolicies: RemotePolicy[];
  seniorityLevels: SeniorityLevel[];
  employmentTypes: EmploymentType[];
  dateRange: DateRangeOption;
  locations: string[];
}
