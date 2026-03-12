import { COUNTRIES } from '../constants';
import { EmploymentType, JobPosting, JobSourceType, RemotePolicy, SeniorityLevel } from '../types';

export type SubmissionFieldKey =
  | 'externalLink'
  | 'roleTitle'
  | 'companyName'
  | 'locationCountry'
  | 'locationCity'
  | 'submitterName'
  | 'submitterEmail';

export type SubmissionFieldErrors = Partial<Record<SubmissionFieldKey, string>>;

export const submissionFieldOrder: SubmissionFieldKey[] = [
  'externalLink',
  'roleTitle',
  'companyName',
  'locationCountry',
  'locationCity',
  'submitterName',
  'submitterEmail'
];

export const submissionFieldLabels: Record<SubmissionFieldKey, string> = {
  externalLink: 'Apply link',
  roleTitle: 'Role title',
  companyName: 'Company name',
  locationCountry: 'Country',
  locationCity: 'City',
  submitterName: 'Your name',
  submitterEmail: 'Your email'
};

export const toDateTimeLocal = (isoDate?: string): string => {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  const timezoneOffsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
};

export const getInitialState = (sourceType: JobSourceType): Partial<JobPosting> => ({
  companyName: '',
  companyWebsite: '',
  roleTitle: '',
  externalLink: '',
  locationCity: '',
  locationState: '',
  locationCountry: '',
  salaryRange: '',
  currency: '',
  intelligenceSummary: '',
  externalSource: sourceType === 'Direct' ? 'Direct' : 'Manual Web Import',
  tags: [],
  sourceType,
  isVerified: sourceType === 'Direct',
  status: sourceType === 'Direct' ? 'pending' : 'active'
});

const PLACEHOLDER_TEXT_VALUES = new Set([
  'n/a',
  'na',
  'none',
  'unknown',
  'unspecified',
  'not specified',
  'not available',
  'not provided',
  'not set',
  'null',
  'undefined',
  'tbd',
  'to be decided'
]);

export const isPlaceholderText = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  return PLACEHOLDER_TEXT_VALUES.has(normalized);
};

export const normalizeMeaningfulString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (isPlaceholderText(trimmed)) return undefined;
  return trimmed;
};

export const normalizeAIData = (data: Record<string, unknown>): Partial<JobPosting> => {
  const {
    summary,
    employmentType,
    seniority,
    locationCountry: rawLocationCountry,
    remotePolicy: rawRemotePolicy,
    ...rest
  } = data;

  const allowedStringFields = new Set([
    'companyName',
    'roleTitle',
    'companyWebsite',
    'locationCity',
    'locationState',
    'region',
    'salaryRange',
    'currency',
    'externalSource'
  ]);

  const safeRest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (key === 'externalLink' || key === 'submitterEmail' || key === 'submitterName') continue;
    if (allowedStringFields.has(key) && typeof value === 'string') {
      const normalizedString = normalizeMeaningfulString(value);
      if (normalizedString) {
        safeRest[key] = normalizedString;
      }
      continue;
    }
    if (key === 'tags' && Array.isArray(value)) {
      const normalizedTags = value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0 && !isPlaceholderText(entry));
      if (normalizedTags.length > 0) {
        safeRest[key] = normalizedTags;
      }
    }
  }

  let locationCountry = normalizeMeaningfulString(rawLocationCountry) || '';
  let remotePolicy = normalizeMeaningfulString(rawRemotePolicy) || '';
  let normalizedEmploymentType = normalizeMeaningfulString(employmentType) || '';
  let normalizedSeniority = normalizeMeaningfulString(seniority) || '';

  if (locationCountry === 'USA' || locationCountry === 'US') locationCountry = 'United States';
  if (locationCountry === 'UK' || locationCountry === 'Germany' || locationCountry === 'France') locationCountry = 'Europe';
  if (!COUNTRIES.includes(locationCountry)) locationCountry = '';

  if (!Object.values(RemotePolicy).includes(remotePolicy as RemotePolicy)) {
    if (remotePolicy?.toLowerCase().includes('remote')) remotePolicy = RemotePolicy.REMOTE;
    else if (remotePolicy?.toLowerCase().includes('hybrid')) remotePolicy = RemotePolicy.HYBRID;
    else if (remotePolicy?.toLowerCase().includes('onsite') || remotePolicy?.toLowerCase().includes('office')) remotePolicy = RemotePolicy.ONSITE;
    else remotePolicy = '';
  }

  if (!Object.values(EmploymentType).includes(normalizedEmploymentType as EmploymentType)) {
    const lower = normalizedEmploymentType.toLowerCase();
    if (lower.includes('full')) normalizedEmploymentType = EmploymentType.FULL_TIME;
    else if (lower.includes('contract')) normalizedEmploymentType = EmploymentType.CONTRACT;
    else if (lower.includes('intern')) normalizedEmploymentType = EmploymentType.INTERNSHIP;
    else normalizedEmploymentType = '';
  }

  if (!Object.values(SeniorityLevel).includes(normalizedSeniority as SeniorityLevel)) {
    const lower = normalizedSeniority.toLowerCase();
    if (lower.includes('junior') || lower === 'jr') normalizedSeniority = SeniorityLevel.JUNIOR;
    else if (lower.includes('mid')) normalizedSeniority = SeniorityLevel.MID;
    else if (lower.includes('senior') || lower === 'sr') normalizedSeniority = SeniorityLevel.SENIOR;
    else if (lower.includes('lead') || lower.includes('staff') || lower.includes('principal')) normalizedSeniority = SeniorityLevel.LEAD;
    else if (lower.includes('exec') || lower.includes('director') || lower.includes('vp')) normalizedSeniority = SeniorityLevel.EXECUTIVE;
    else normalizedSeniority = '';
  }

  const normalized: Partial<JobPosting> = {
    ...safeRest,
    ...(locationCountry ? { locationCountry } : {}),
    ...(remotePolicy ? { remotePolicy: remotePolicy as RemotePolicy } : {}),
    ...(normalizedEmploymentType ? { employmentType: normalizedEmploymentType as EmploymentType } : {}),
    ...(normalizedSeniority ? { seniority: normalizedSeniority as SeniorityLevel } : {})
  };

  const normalizedSummary = normalizeMeaningfulString(summary);
  if (normalizedSummary) {
    normalized.intelligenceSummary = normalizedSummary;
  }

  return normalized;
};

export const sanitizePayloadForSubmit = (payload: Partial<JobPosting>): Partial<JobPosting> => {
  const cleaned: Record<string, unknown> = { ...payload };
  for (const [key, value] of Object.entries(cleaned)) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      cleaned[key] = trimmed;
      if (trimmed === '' || isPlaceholderText(trimmed)) {
        delete cleaned[key];
      }
    }
  }

  if (cleaned.remotePolicy && !Object.values(RemotePolicy).includes(cleaned.remotePolicy as RemotePolicy)) {
    delete cleaned.remotePolicy;
  }
  if (cleaned.employmentType && !Object.values(EmploymentType).includes(cleaned.employmentType as EmploymentType)) {
    delete cleaned.employmentType;
  }
  if (cleaned.seniority && !Object.values(SeniorityLevel).includes(cleaned.seniority as SeniorityLevel)) {
    delete cleaned.seniority;
  }

  if (cleaned.tags && !Array.isArray(cleaned.tags)) {
    delete cleaned.tags;
  }
  if (Array.isArray(cleaned.tags) && cleaned.tags.length === 0) {
    delete cleaned.tags;
  }

  return cleaned as Partial<JobPosting>;
};

export const validateRequiredFields = ({
  formData,
  isAdminMode,
  trimmedSubmitterName,
  trimmedSubmitterEmail,
  trimmedExternalLink
}: {
  formData: Partial<JobPosting>;
  isAdminMode: boolean;
  trimmedSubmitterName: string;
  trimmedSubmitterEmail: string;
  trimmedExternalLink: string;
}): SubmissionFieldErrors => {
  const errors: SubmissionFieldErrors = {};
  if (!trimmedExternalLink) errors.externalLink = 'Apply link is required.';
  if (!normalizeMeaningfulString(formData.roleTitle)) errors.roleTitle = 'Role title is required.';
  if (!normalizeMeaningfulString(formData.companyName)) errors.companyName = 'Company name is required.';
  if (!normalizeMeaningfulString(formData.locationCountry)) errors.locationCountry = 'Country is required.';
  if (!normalizeMeaningfulString(formData.locationCity)) errors.locationCity = 'City is required.';
  if (!isAdminMode && !normalizeMeaningfulString(trimmedSubmitterName)) errors.submitterName = 'Your name is required.';
  if (!isAdminMode && !trimmedSubmitterEmail) errors.submitterEmail = 'Your email is required.';
  return errors;
};

export const mapSubmissionError = (
  rawMessage: string,
  payload?: unknown
): { message: string; fieldErrors: SubmissionFieldErrors } => {
  const message = rawMessage.trim();
  const lower = message.toLowerCase();
  const nextFieldErrors: SubmissionFieldErrors = {};
  const payloadFields =
    payload && typeof payload === 'object' && 'fields' in payload && Array.isArray((payload as { fields?: unknown }).fields)
      ? ((payload as { fields: unknown[] }).fields.filter((value): value is SubmissionFieldKey => submissionFieldOrder.includes(value as SubmissionFieldKey)))
      : [];

  if (payloadFields.length > 0) {
    payloadFields.forEach((field) => {
      if (field === 'externalLink') {
        nextFieldErrors.externalLink = 'Enter a valid apply URL (must start with http:// or https://).';
        return;
      }
      if (field === 'submitterEmail') {
        nextFieldErrors.submitterEmail = 'Use a valid email address for submission updates.';
        return;
      }
      const label = submissionFieldLabels[field];
      nextFieldErrors[field] = `${label} is required.`;
    });
  }

  if (lower.includes('valid apply link') || lower.includes('apply link') || lower.includes('external link')) {
    nextFieldErrors.externalLink = 'Enter a valid apply URL (must start with http:// or https://).';
  }
  if (lower.includes('valid email')) {
    nextFieldErrors.submitterEmail = 'Use a valid email address for submission updates.';
  }
  if (lower.includes('company name and role title')) {
    nextFieldErrors.companyName = 'Company name is required.';
    nextFieldErrors.roleTitle = 'Role title is required.';
  }
  if (lower.includes('country and city')) {
    nextFieldErrors.locationCountry = 'Country is required.';
    nextFieldErrors.locationCity = 'City is required.';
  }

  if (lower.includes('invalid submission payload')) {
    return {
      message:
        payloadFields.length > 0
          ? 'Please complete the required fields highlighted below and try again.'
          : 'Some required fields are missing or invalid. Check the highlighted fields and try again.',
      fieldErrors: nextFieldErrors
    };
  }

  if (lower.includes('too many requests') || lower.includes('rate limit') || lower.includes('rate limited')) {
    return {
      message: 'Too many attempts right now. Please wait a minute and try again.',
      fieldErrors: nextFieldErrors
    };
  }

  return {
    message: message || 'Failed to submit job. Please try again.',
    fieldErrors: nextFieldErrors
  };
};

export const listMissingRequiredFields = (errors: SubmissionFieldErrors): string[] => {
  return submissionFieldOrder
    .filter((key) => Boolean(errors[key]))
    .map((key) => submissionFieldLabels[key]);
};
