
import React, { useState, useEffect, useId, useMemo, useRef } from 'react';
import { EmploymentType, JobPosting, JobSourceType, RemotePolicy, SeniorityLevel } from '../types';
import { COUNTRIES, PROVINCES } from '../constants';
import { analyzeJobDescription } from '../services/geminiService';
import { Sparkles, Loader2, CheckCircle2, AlertCircle, X, HelpCircle } from 'lucide-react';
import { submitJob, updateJob, createAdminJob } from '../services/jobService';
import { CONTACT_EMAIL } from '../siteConfig';
import { buildFeedbackMailto } from '../utils/feedbackMailto';
import {
  getInitialState,
  mapSubmissionError,
  listMissingRequiredFields,
  normalizeAIData,
  sanitizePayloadForSubmit,
  SubmissionFieldErrors,
  SubmissionFieldKey,
  submissionFieldOrder,
  toDateTimeLocal,
  validateRequiredFields
} from '../utils/submitJobFormUtils';

interface SubmitJobFormProps {
  onSuccess: () => void;
  onOpenTerms: () => void;
  onOpenAdminDashboard?: () => void;
  initialData?: JobPosting;
  isAdminMode?: boolean;
  defaultSourceType?: JobSourceType;
}

const SUBMIT_DRAFT_STORAGE_PREFIX = 'commons_jobs_submit_draft_v1';

type SubmitDraftPayload = {
  formData: Partial<JobPosting>;
  jdText: string;
  submitterName: string;
  submitterEmail: string;
  postedDateInput: string;
  aiFallbackNotice: boolean;
};

const getDraftStorageKey = (isAdminMode: boolean, defaultSourceType: JobSourceType): string =>
  `${SUBMIT_DRAFT_STORAGE_PREFIX}:${isAdminMode ? 'admin' : 'public'}:${defaultSourceType}`;

const loadSubmitDraft = (key: string): SubmitDraftPayload | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SubmitDraftPayload;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
};

const saveSubmitDraft = (key: string, payload: SubmitDraftPayload) => {
  try {
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore storage write errors (private mode/quota).
  }
};

const clearSubmitDraft = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage deletion errors.
  }
};

type InputFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  required?: boolean;
  id?: string;
  error?: string;
};

const InputField: React.FC<InputFieldProps> = ({ label, required, id, name, error, ...props }) => {
  const autoId = useId();
  const inputId = id || `field-${autoId}`;

  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        id={inputId}
        name={name || inputId}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...props}
        className={`w-full px-3 py-2 bg-white border rounded-lg focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all text-sm placeholder:text-gray-400 ${
          error ? 'border-red-300' : 'border-gray-300'
        }`}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
};

type SelectFieldProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: string[];
  required?: boolean;
  id?: string;
  error?: string;
};

const SelectField: React.FC<SelectFieldProps> = ({ label, required, options, id, name, error, ...props }) => {
  const autoId = useId();
  const selectId = id || `field-${autoId}`;

  return (
    <div className="space-y-1">
      <label htmlFor={selectId} className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        id={selectId}
        name={name || selectId}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${selectId}-error` : undefined}
        {...props}
        className={`w-full px-3 py-2 bg-white border rounded-lg focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all text-sm ${
          error ? 'border-red-300' : 'border-gray-300'
        }`}
      >
        <option value="">Select...</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${selectId}-error`} className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
};

const SubmitJobForm: React.FC<SubmitJobFormProps> = ({
  onSuccess,
  onOpenTerms,
  onOpenAdminDashboard,
  initialData,
  isAdminMode = false,
  defaultSourceType = 'Direct' as JobSourceType
}) => {
  const isEditing = !!initialData;
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedJobId, setSubmittedJobId] = useState<string | null>(null);
  const [jdText, setJdText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<SubmissionFieldErrors>({});
  const [aiFallbackNotice, setAiFallbackNotice] = useState(false);
  const [scrapeToast, setScrapeToast] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  
  const jdInputRef = useRef<HTMLTextAreaElement>(null);
  const step1Ref = useRef<HTMLElement>(null);
  const step2Ref = useRef<HTMLElement>(null);
  const step3Ref = useRef<HTMLElement>(null);
  const applyLinkId = useId();
  const roleTitleId = useId();
  const companyNameId = useId();
  const countryId = useId();
  const jdTextId = useId();
  const cityId = useId();
  const submitterNameId = useId();
  const submitterEmailId = useId();
  const showAdminShortcut = Boolean(onOpenAdminDashboard);
  const draftStorageKey = useMemo(
    () => getDraftStorageKey(isAdminMode, defaultSourceType),
    [defaultSourceType, isAdminMode]
  );

  const scrollToTop = () => {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // JSDOM and some non-browser runtimes don't implement scrollTo.
    }
  };

  const [formData, setFormData] = useState<Partial<JobPosting>>(
      initialData || getInitialState(defaultSourceType)
  );

  const [submitterName, setSubmitterName] = useState(initialData?.submitterName || '');
  const [submitterEmail, setSubmitterEmail] = useState(initialData?.submitterEmail || '');
  const [postedDateInput, setPostedDateInput] = useState(toDateTimeLocal(initialData?.postedDate));

  const fieldIdByKey = useMemo<Record<SubmissionFieldKey, string>>(
    () => ({
      externalLink: applyLinkId,
      roleTitle: roleTitleId,
      companyName: companyNameId,
      locationCountry: countryId,
      locationCity: cityId,
      submitterName: submitterNameId,
      submitterEmail: submitterEmailId
    }),
    [applyLinkId, cityId, companyNameId, countryId, roleTitleId, submitterEmailId, submitterNameId]
  );

  const clearFieldError = (field: SubmissionFieldKey) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const focusFirstInvalidField = (errors: SubmissionFieldErrors) => {
    const firstInvalidField = submissionFieldOrder.find((field) => Boolean(errors[field]));
    if (!firstInvalidField) return false;
    const targetId = fieldIdByKey[firstInvalidField];
    if (!targetId) return false;
    const element = document.getElementById(targetId) as HTMLElement | null;
    if (!element) return false;
    element.focus();
    if (typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return true;
  };

  const scrollToStep = (ref: React.RefObject<HTMLElement>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const liveValidationErrors = useMemo(
    () =>
      validateRequiredFields({
        formData,
        isAdminMode,
        trimmedSubmitterName: submitterName.trim(),
        trimmedSubmitterEmail: submitterEmail.trim(),
        trimmedExternalLink: (formData.externalLink || '').trim()
      }),
    [formData, isAdminMode, submitterEmail, submitterName]
  );

  const missingRequiredFields = useMemo(() => listMissingRequiredFields(liveValidationErrors), [liveValidationErrors]);
  const requiredFieldsTotal = isAdminMode ? 5 : 7;
  const requiredFieldsCompleted = requiredFieldsTotal - missingRequiredFields.length;


  useEffect(() => {
    if (isEditing) return;
    const draft = loadSubmitDraft(draftStorageKey);
    if (!draft) return;

    setFormData((prev) => ({ ...prev, ...draft.formData }));
    setJdText(draft.jdText || '');
    setSubmitterName(draft.submitterName || '');
    setSubmitterEmail(draft.submitterEmail || '');
    setPostedDateInput(draft.postedDateInput || '');
    setAiFallbackNotice(Boolean(draft.aiFallbackNotice));
    setDraftRestored(true);
  }, [draftStorageKey, isEditing]);

  useEffect(() => {
    if (isEditing || isSubmitted) return;
    const timer = window.setTimeout(() => {
      saveSubmitDraft(draftStorageKey, {
        formData,
        jdText,
        submitterName,
        submitterEmail,
        postedDateInput,
        aiFallbackNotice
      });
    }, 800);

    return () => window.clearTimeout(timer);
  }, [
    aiFallbackNotice,
    draftStorageKey,
    formData,
    isEditing,
    isSubmitted,
    jdText,
    postedDateInput,
    submitterEmail,
    submitterName
  ]);

  // Auto-clear toast
  useEffect(() => {
    if (scrapeToast) {
      const timer = setTimeout(() => setScrapeToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [scrapeToast]);

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCountry = e.target.value;
    clearFieldError('locationCountry');
    setFormData(prev => ({
      ...prev,
      locationCountry: newCountry,
      locationState: '' // Reset state
    }));
  };

  const handleLinkAutofill = async () => {
    if (!formData.externalLink) {
        setError('Please enter a link first.');
        setFieldErrors((prev) => ({ ...prev, externalLink: 'Apply link is required before auto-fill.' }));
        return;
    }
    
    setIsScraping(true);
    setError(null);

    // Simulate scraping delay then blocking
    setTimeout(() => {
        setIsScraping(false);
        setScrapeToast(true); // Trigger "Blocked by host" toast
        if (jdInputRef.current) {
            jdInputRef.current.focus();
            jdInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 1200);
  };


  const handleAIAnalysis = async () => {
    if (!jdText.trim()) return;

    setIsAnalyzing(true);
    setError(null);
    setAiFallbackNotice(false);
    try {
      const analysisResponse = await analyzeJobDescription(jdText);
      const rawAnalysis = analysisResponse?.result ?? null;
      if (rawAnalysis) {
        const normalized = normalizeAIData(rawAnalysis);
        setFormData((prev) => ({
          ...prev,
          ...normalized,
          intelligenceSummary: typeof rawAnalysis.summary === 'string' ? rawAnalysis.summary : prev.intelligenceSummary
        }));
        setAiFallbackNotice(Boolean(analysisResponse?.fallback));
      } else {
          setError('AI analysis failed. Please fill details manually.');
      }
    } catch {
      setError('Failed to analyze job description.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedSubmitterName = submitterName.trim();
    const trimmedSubmitterEmail = submitterEmail.trim();
    const trimmedExternalLink = (formData.externalLink || '').trim();
    const nextFieldErrors = validateRequiredFields({
      formData,
      isAdminMode,
      trimmedSubmitterName,
      trimmedSubmitterEmail,
      trimmedExternalLink
    });

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setError('Please fix the highlighted fields before submitting.');
      scrollToTop();
      setTimeout(() => {
        if (!focusFirstInvalidField(nextFieldErrors)) {
          errorRef.current?.focus();
        }
      }, 0);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      const payload: Partial<JobPosting> = {
        ...formData,
        externalLink: trimmedExternalLink,
        sourceType: formData.sourceType || 'Direct',
        status: formData.status || (formData.sourceType === 'Aggregated' ? 'active' : 'pending')
      };

      if (trimmedSubmitterName) payload.submitterName = trimmedSubmitterName;
      if (trimmedSubmitterEmail) payload.submitterEmail = trimmedSubmitterEmail;
      const sanitizedPayload = sanitizePayloadForSubmit(payload);
      
      let newJobId: string | null = null;
      if (isEditing && initialData) {
        await updateJob({ ...initialData, ...sanitizedPayload } as JobPosting);
        newJobId = initialData.id;
      } else if (isAdminMode) {
        const job = await createAdminJob(sanitizedPayload as Parameters<typeof createAdminJob>[0]);
        newJobId = job?.id || null;
      } else {
        newJobId = await submitJob(sanitizedPayload as Parameters<typeof submitJob>[0]);
      }
	      
	      setSubmittedJobId(newJobId);
		      setIsSubmitted(true);
          clearSubmitDraft(draftStorageKey);
		      scrollToTop();
		      setTimeout(() => successHeadingRef.current?.focus(), 0);
		    } catch (err) {
		      const message = err instanceof Error ? err.message : 'Failed to submit job. Please try again.';
          const mapped = mapSubmissionError(message);
          if (Object.keys(mapped.fieldErrors).length > 0) {
            setFieldErrors(mapped.fieldErrors);
          }
		      setError(mapped.message);
		      scrollToTop();
		      setTimeout(() => {
            if (!focusFirstInvalidField(mapped.fieldErrors)) {
              errorRef.current?.focus();
            }
          }, 0);
		    } finally {
	      setIsSubmitting(false);
	    }
	  };

	  if (isSubmitted) {
	      return (
	          <div className="max-w-xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center mt-8">
	              <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
	                  <CheckCircle2 size={24} />
	              </div>
	              <h2
	                ref={successHeadingRef}
	                tabIndex={-1}
	                className="text-xl font-bold text-gray-900 mb-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
	              >
	                {isEditing ? 'Changes Saved' : (isAdminMode ? 'Job Created' : 'Submission Received')}
	              </h2>
	              <p className="text-gray-500 mb-6 text-sm">
	                  {isEditing
	                    ? 'Your job posting has been successfully updated.'
	                    : (isAdminMode
	                      ? 'The posting has been added to the board.'
	                      : "Your post is now in the review queue. It won’t appear publicly until an admin approves it.")}
	              </p>

	              {!isEditing && !isAdminMode && (
	                <div className="text-left bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
	                  <div className="text-xs font-bold text-blue-900 uppercase tracking-wide mb-2">What happens next</div>
	                  <ul className="text-sm text-blue-900 space-y-1">
	                    <li>1. Your submission is queued for admin review.</li>
	                    <li>2. Typical review time: 24 hours (up to 48 hours during high volume).</li>
	                    <li>3. Once approved, it becomes visible on the public board.</li>
	                  </ul>
	                </div>
	              )}

		              {submittedJobId && (
		                <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3 mb-6 text-left">
		                  <div className="font-bold text-gray-700 mb-1">Reference ID</div>
		                  <div className="font-mono text-gray-800 break-all">{submittedJobId}</div>
		                  {!isAdminMode && !isEditing && (
		                    <div className="mt-2">
		                      If you need to follow up, email{' '}
		                      <a
		                        className="text-blue-600 hover:underline"
		                        href={`mailto:${CONTACT_EMAIL}?subject=Job%20submission%20${encodeURIComponent(submittedJobId)}`}
		                      >
		                        {CONTACT_EMAIL}
		                      </a>{' '}
		                      and include this ID.{' '}
		                      <a
		                        className="text-gray-700 underline underline-offset-2 hover:text-gray-900"
		                        href={buildFeedbackMailto({ submissionId: submittedJobId })}
		                      >
		                        Send beta feedback
		                      </a>
		                    </div>
		                  )}
		                </div>
		              )}

	              <div className="flex flex-col gap-3 items-center">
	                {!isEditing && (
	                  <button
	                    type="button"
	                    onClick={() => {
	                      setIsSubmitted(false);
	                      setSubmittedJobId(null);
	                      setFormData(getInitialState(defaultSourceType));
	                      setPostedDateInput('');
	                      setJdText('');
	                      setSubmitterName('');
	                      setSubmitterEmail('');
	                      setError(null);
                        setFieldErrors({});
                        setAiFallbackNotice(false);
                        setDraftRestored(false);
                        clearSubmitDraft(draftStorageKey);
	                      scrollToTop();
	                    }}
	                    className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition-colors"
	                  >
	                    {isAdminMode ? 'Create Another Job' : 'Submit Another Role'}
	                  </button>
	                )}

	                {showAdminShortcut && (
	                  <button
	                    type="button"
	                    onClick={onOpenAdminDashboard}
	                    className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-white text-gray-900 text-sm font-bold border border-gray-200 hover:bg-gray-50 transition-colors"
	                  >
	                    Open Admin Dashboard
	                  </button>
	                )}

	                <button
	                  type="button"
	                  onClick={onSuccess}
	                  className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-white text-gray-900 text-sm font-bold border border-gray-200 hover:bg-gray-50 transition-colors"
	                >
	                  {isEditing || isAdminMode ? 'Back to Dashboard' : 'Back to Browse'}
	                </button>
	              </div>
	          </div>
	      );
	  }

  return (
    <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 relative">
      
      {/* Toast */}
	      {scrapeToast && (
	        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 w-[90%] md:w-auto animate-fade-in">
	            <AlertCircle size={18} className="text-yellow-400 shrink-0" />
	            <div className="text-sm font-medium">Auto-fill blocked by host. Paste JD below, then generate summary and continue submission.</div>
	            <button type="button" onClick={() => setScrapeToast(false)} className="ml-auto hover:text-gray-300" aria-label="Close message"><X size={16} /></button>
	        </div>
	      )}

      <div className="p-6 border-b border-gray-100 bg-gray-50">
        <h2 className="text-xl font-bold text-gray-900 tracking-tight">
          {isEditing ? 'Edit Job' : (isAdminMode ? 'Create Job' : 'Post a Role')}
        </h2>
      </div>

      <form onSubmit={handleSubmit} noValidate className="p-6 md:p-8 space-y-8">
            <div className="sticky top-20 z-10 rounded-xl border border-[#cdece8] bg-[#f4fbfa] px-4 py-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-[#0b5f58] uppercase tracking-wide">Submission Progress</div>
                <div className="text-xs font-semibold text-[#0b5f58]">
                  {requiredFieldsCompleted}/{requiredFieldsTotal} required fields complete
                </div>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-[#d7efec]">
                <div
                  className="h-2 rounded-full bg-[#2EC4B6] transition-all"
                  style={{ width: `${Math.max(0, Math.min(100, (requiredFieldsCompleted / requiredFieldsTotal) * 100))}%` }}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => scrollToStep(step1Ref)} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 border border-gray-200 hover:border-[#2EC4B6]">1. Link + JD</button>
                <button type="button" onClick={() => scrollToStep(step2Ref)} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 border border-gray-200 hover:border-[#2EC4B6]">2. Role Details</button>
                <button type="button" onClick={() => scrollToStep(step3Ref)} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 border border-gray-200 hover:border-[#2EC4B6]">{isAdminMode ? '3. Contact + Publish' : '3. Contact + Submit'}</button>
              </div>
              {missingRequiredFields.length > 0 && (
                <p className="mt-3 text-xs text-[#0b5f58]">
                  Missing: {missingRequiredFields.join(', ')}
                </p>
              )}
            </div>
	          {error && (
	            <div
	              ref={errorRef}
	              role="alert"
	              tabIndex={-1}
	              className="bg-red-50 text-red-700 p-3 rounded-lg text-sm font-medium border border-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
	            >
	              {error}
                {Object.keys(fieldErrors).length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-xs">
                    {listMissingRequiredFields(fieldErrors).map((field) => (
                      <li key={field}>{field}</li>
                    ))}
                  </ul>
                )}
	            </div>
	          )}

          {draftRestored && !isEditing && (
            <div className="rounded-lg border border-[#cdece8] bg-[#f4fbfa] p-3 text-xs text-[#0b5f58]">
              Restored your unsent draft from this browser.
            </div>
          )}

          {!isAdminMode && (
            <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm border border-blue-100">
              Moderation note: community submissions are typically reviewed within 24 hours and may take up to 48 hours during high volume.
            </div>
          )}

          {/* Step 1: Link & Intelligence */}
          <section id="submit-step-1" ref={step1Ref} className="space-y-4">
	             <div className="flex items-center justify-between">
	                <label htmlFor={applyLinkId} className="block text-sm font-bold text-gray-900">
	                  1. {isAdminMode ? 'Role Source Link' : 'Link to Apply (JD)'}
	                </label>
                <button
                    type="button"
                    onClick={handleLinkAutofill}
                    disabled={isScraping || !formData.externalLink}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 disabled:opacity-50"
                >
                    {isScraping ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />}
                    {isScraping ? 'Analyzing...' : 'Auto-Fill Intelligence'}
                </button>
             </div>
             
			             <input 
		                id={applyLinkId}
		                required 
		                type="url" 
		                placeholder="https://company.com/jobs/..." 
		                className={`w-full px-4 py-3 bg-white border rounded-lg focus:ring-1 focus:ring-blue-600 outline-none transition-all text-base ${
                      fieldErrors.externalLink ? 'border-red-300' : 'border-gray-300'
                    }`}
                    aria-invalid={Boolean(fieldErrors.externalLink)}
                    aria-describedby={fieldErrors.externalLink ? `${applyLinkId}-error` : undefined}
		                value={formData.externalLink || ''} 
		                onChange={(e) => {
                      clearFieldError('externalLink');
                      setFormData((prev) => ({ ...prev, externalLink: e.target.value }));
                    }} 
			             />
                {fieldErrors.externalLink && (
                  <p id={`${applyLinkId}-error`} className="text-xs text-red-600">
                    {fieldErrors.externalLink}
                  </p>
                )}

	             {/* JD Paste Fallback */}
	             <div className="bg-white rounded-lg p-4 border border-gray-200 transition-colors">
	                <label htmlFor={jdTextId} className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
	                    Paste Job Description (Intelligence Engine)
	                </label>
                  {aiFallbackNotice && (
                    <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      <div className="flex items-center gap-2">
                        <span>AI model unavailable, using fallback extraction.</span>
                        <button
                          type="button"
                          className="ml-auto rounded px-1.5 py-0.5 text-amber-900 hover:bg-amber-100"
                          onClick={() => setAiFallbackNotice(false)}
                          aria-label="Dismiss fallback notice"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  )}
	                <textarea
	                    id={jdTextId}
	                    ref={jdInputRef}
	                    className="w-full p-3 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-600 min-h-[120px] bg-white placeholder:text-gray-400"
	                    placeholder="If auto-fill fails, paste the full JD text here. The AI will extract role details, location, and tags for you."
	                    value={jdText}
	                    onChange={(e) => setJdText(e.target.value)}
	                />
                <button
                    type="button"
                    onClick={handleAIAnalysis}
                    disabled={isAnalyzing || !jdText}
                    className="mt-2 text-xs font-bold text-gray-600 hover:text-gray-900 flex items-center gap-1"
                >
                    {isAnalyzing ? (
                        <>
                           <Loader2 className="animate-spin" size={12} /> Processing...
                        </>
                    ) : (
                        <>
                           <Sparkles size={12} /> Generate Summary & Tags
                        </>
                    )}
                </button>
             </div>
          </section>

          <hr className="border-gray-100" />

          {/* Step 2: Core Details */}
          <section id="submit-step-2" ref={step2Ref} className="space-y-6">
            <h3 className="text-sm font-bold text-gray-900">2. Role Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
	              <div className="md:col-span-2">
	                 <InputField
                    id={roleTitleId}
                    label="Role Title"
                    required
                    value={formData.roleTitle || ''}
                    error={fieldErrors.roleTitle}
                    onChange={(e) => {
                      clearFieldError('roleTitle');
                      setFormData((prev) => ({ ...prev, roleTitle: e.target.value }));
                    }}
                  />
	              </div>
	
	              <InputField
                  id={companyNameId}
                  label="Company Name"
                  required
                  value={formData.companyName || ''}
                  error={fieldErrors.companyName}
                  onChange={(e) => {
                    clearFieldError('companyName');
                    setFormData((prev) => ({ ...prev, companyName: e.target.value }));
                  }}
                />
	              <InputField label="Company Website" value={formData.companyWebsite || ''} onChange={(e) => setFormData((prev) => ({ ...prev, companyWebsite: e.target.value }))} />
	
	              <SelectField label="Remote Policy" required options={Object.values(RemotePolicy)} value={formData.remotePolicy || ''} onChange={(e) => setFormData((prev) => ({ ...prev, remotePolicy: e.target.value as RemotePolicy }))} />
	              <SelectField label="Employment Type" options={Object.values(EmploymentType)} value={formData.employmentType || ''} onChange={(e) => setFormData((prev) => ({ ...prev, employmentType: e.target.value as EmploymentType }))} />
	            </div>

            {/* Location Hierarchy */}
            <div className="bg-white p-5 rounded-lg border border-gray-200 space-y-4">
                 <h4 className="text-xs font-bold text-gray-500 uppercase">Location Hierarchy</h4>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <SelectField
                        label="Country"
                        required
                        id={countryId}
                        options={COUNTRIES}
                        value={formData.locationCountry || ''}
                        error={fieldErrors.locationCountry}
                        onChange={handleCountryChange}
                     />
	                     <SelectField 
	                        label="State/Province" 
	                        required={false}
	                        options={formData.locationCountry ? (PROVINCES[formData.locationCountry] || []) : []} 
	                        value={formData.locationState || ''} 
	                        onChange={(e) => setFormData((prev) => ({ ...prev, locationState: e.target.value }))} 
	                        disabled={!formData.locationCountry}
	                     />
	                     <div className="space-y-1">
	                         <label htmlFor={cityId} className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
	                           City <span className="text-red-500">*</span>
	                         </label>
		                         <input 
		                             required
		                             id={cityId}
		                             type="text" 
		                             placeholder="City (e.g., Toronto)" 
                               autoComplete="address-level2"
		                             className={`w-full px-3 py-2 bg-white border rounded-lg focus:ring-1 focus:ring-blue-600 outline-none text-sm ${
                                   fieldErrors.locationCity ? 'border-red-300' : 'border-gray-300'
                                 }`}
                               aria-invalid={Boolean(fieldErrors.locationCity)}
                               aria-describedby={fieldErrors.locationCity ? `${cityId}-error` : undefined}
		                             value={formData.locationCity || ''}
		                             onChange={(e) => {
                                   clearFieldError('locationCity');
                                   setFormData((prev) => ({ ...prev, locationCity: e.target.value }));
                                 }}
		                         />
                           {fieldErrors.locationCity && (
                             <p id={`${cityId}-error`} className="text-xs text-red-600">
                               {fieldErrors.locationCity}
                             </p>
                           )}
	                     </div>
                 </div>
            </div>

            <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                    Editable Intelligence Summary <span className="text-gray-400 font-normal ml-1">(AI Generated)</span>
                </label>
                <textarea 
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-600 text-sm" 
	                    rows={3}
	                    placeholder="Brief 3-sentence summary of the role..."
	                    value={formData.intelligenceSummary || ''} 
	                    onChange={(e) => setFormData((prev) => ({ ...prev, intelligenceSummary: e.target.value }))} 
	                />
            </div>
          </section>

          <hr className="border-gray-100" />

          {/* Step 3: Admin Publishing Controls */}
          {isAdminMode && (
            <>
              <section id="submit-step-3" ref={step3Ref} className="space-y-6">
                <h3 className="text-sm font-bold text-gray-900">3. Publishing Controls</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <SelectField
                    label="Source Type"
                    required
                    options={['Direct', 'Aggregated']}
                    value={formData.sourceType || 'Direct'}
                    onChange={e => {
                      const nextSource = e.target.value as JobSourceType;
                      setFormData(prev => ({
                        ...prev,
                        sourceType: nextSource,
                        isVerified: nextSource === 'Direct' ? (prev.isVerified ?? true) : (prev.isVerified ?? false),
                        externalSource: prev.externalSource || (nextSource === 'Direct' ? 'Direct' : 'Manual Web Import')
                      }));
                    }}
                  />
	                  <InputField
	                    label="External Source"
	                    value={formData.externalSource || ''}
	                    onChange={(e) => setFormData((prev) => ({ ...prev, externalSource: e.target.value }))}
	                    placeholder="LinkedIn, Workday, Company Careers"
	                  />
                  <SelectField
                    label="Verification"
	                    required
	                    options={['Verified', 'Unverified']}
	                    value={(formData.isVerified ?? true) ? 'Verified' : 'Unverified'}
	                    onChange={(e) => setFormData((prev) => ({ ...prev, isVerified: e.target.value === 'Verified' }))}
	                  />
                  <SelectField
                    label="Status"
	                    required
	                    options={['pending', 'active', 'rejected', 'archived']}
	                    value={formData.status || 'pending'}
	                    onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as JobPosting['status'] }))}
	                  />
                  <InputField
                    label="Posted Date"
                    type="datetime-local"
	                    value={postedDateInput}
	                    onChange={e => {
	                      const localDate = e.target.value;
	                      setPostedDateInput(localDate);
	                      setFormData((prev) => ({
	                        ...prev,
	                        postedDate: localDate ? new Date(localDate).toISOString() : undefined
	                      }));
	                    }}
	                  />
                </div>
              </section>
              <hr className="border-gray-100" />
            </>
          )}

          {/* Step 4: Contact */}
          <section id={isAdminMode ? undefined : 'submit-step-3'} ref={isAdminMode ? undefined : step3Ref} className="space-y-6">
              <h3 className="text-sm font-bold text-gray-900">
                {isAdminMode ? '4. Contact Info (Optional)' : '3. Contact Info (Private)'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
	                <InputField
                    id={submitterNameId}
	                  label="Your Name"
	                  required={!isAdminMode}
                    error={fieldErrors.submitterName}
	                  value={submitterName}
	                  onChange={e => {
                      clearFieldError('submitterName');
                      setSubmitterName(e.target.value);
                    }}
	                />
	                <InputField
                    id={submitterEmailId}
	                  label="Your Email"
	                  required={!isAdminMode}
	                  type="email"
                    error={fieldErrors.submitterEmail}
	                  value={submitterEmail}
	                  onChange={e => {
                      clearFieldError('submitterEmail');
                      setSubmitterEmail(e.target.value);
                    }}
	                />
              </div>
          </section>

          <div className="pt-4 flex flex-col items-center">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-bold text-sm hover:bg-blue-700 disabled:opacity-70 transition-colors shadow-sm"
            >
              {isSubmitting ? 'Processing...' : (isEditing ? 'Save Changes' : (isAdminMode ? 'Create Job' : 'Submit for Verification'))}
            </button>

            {!isAdminMode && (
              <button 
                  type="button"
                  onClick={onOpenTerms} 
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-600 mt-4 transition-colors group"
                  title="View Data, Terms & Common Sense"
              > 
                  <HelpCircle size={14} className="group-hover:text-blue-600" /> 
                  <span className="border-b border-transparent group-hover:border-blue-600">Data, Terms & Common Sense</span>
              </button>
            )}
          </div>
      </form>
    </div>
  );
};

export default SubmitJobForm;
