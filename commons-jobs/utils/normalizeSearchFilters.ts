import { EmploymentType, RemotePolicy, SeniorityLevel, DateRangeOption } from '../types';

type ParsedSearchFilters = {
  keyword?: string;
  remotePolicies?: unknown;
  employmentTypes?: unknown;
  seniorityLevels?: unknown;
  dateRange?: unknown;
};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
};

const normalizeRemotePolicies = (value: unknown): RemotePolicy[] => {
  const out = new Set<RemotePolicy>();
  for (const item of asStringArray(value)) {
    const v = item.trim().toLowerCase();
    if (!v) continue;
    if (v === 'remote' || v === 'wfh' || v.includes('work from home')) out.add(RemotePolicy.REMOTE);
    if (v === 'hybrid') out.add(RemotePolicy.HYBRID);
    if (v === 'onsite' || v === 'on-site' || v === 'in office' || v === 'in-office') out.add(RemotePolicy.ONSITE);
  }
  return Array.from(out);
};

const normalizeEmploymentTypes = (value: unknown): EmploymentType[] => {
  const out = new Set<EmploymentType>();
  for (const item of asStringArray(value)) {
    const v = item.trim().toLowerCase();
    if (!v) continue;
    if (v === 'full-time' || v === 'full time' || v === 'permanent') out.add(EmploymentType.FULL_TIME);
    if (v === 'contract' || v === 'contractor') out.add(EmploymentType.CONTRACT);
    if (v === 'internship' || v === 'intern') out.add(EmploymentType.INTERNSHIP);
  }
  return Array.from(out);
};

const normalizeSeniorityLevels = (value: unknown): SeniorityLevel[] => {
  const out = new Set<SeniorityLevel>();
  for (const item of asStringArray(value)) {
    const v = item.trim().toLowerCase();
    if (!v) continue;
    if (v === 'junior' || v === 'jr') out.add(SeniorityLevel.JUNIOR);
    if (v === 'mid-level' || v === 'mid level' || v === 'mid') out.add(SeniorityLevel.MID);
    if (v === 'senior' || v === 'sr') out.add(SeniorityLevel.SENIOR);
    if (v === 'lead' || v === 'staff' || v === 'principal') out.add(SeniorityLevel.LEAD);
    if (v === 'executive' || v === 'vp' || v === 'director' || v === 'c-level') out.add(SeniorityLevel.EXECUTIVE);
  }
  return Array.from(out);
};

const normalizeDateRange = (value: unknown): DateRangeOption => {
  if (typeof value !== 'string') return 'all';
  const v = value.trim().toLowerCase();
  if (!v) return 'all';
  if (v === '24h' || v === 'today' || v === 'past day' || v === 'last day') return '24h';
  if (v === '7d' || v === 'week' || v === 'past week' || v === 'last week') return '7d';
  if (v === '30d' || v === 'month' || v === 'past month' || v === 'last month') return '30d';
  if (v === 'all' || v === 'any') return 'all';
  return 'all';
};

export const normalizeParsedSearchFilters = (input: ParsedSearchFilters | null) => {
  if (!input) return null;
  const keyword = typeof input.keyword === 'string' ? input.keyword : '';

  return {
    keyword,
    remotePolicies: normalizeRemotePolicies(input.remotePolicies),
    employmentTypes: normalizeEmploymentTypes(input.employmentTypes),
    seniorityLevels: normalizeSeniorityLevels(input.seniorityLevels),
    dateRange: normalizeDateRange(input.dateRange)
  };
};

