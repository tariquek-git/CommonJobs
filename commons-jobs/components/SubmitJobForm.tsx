
import React, { useState, useEffect, useId, useRef } from 'react';
import { EmploymentType, JobPosting, JobSourceType, RemotePolicy, SeniorityLevel } from '../types';
import { COUNTRIES, PROVINCES, MAJOR_CITIES } from '../constants';
import { analyzeJobDescription } from '../services/geminiService';
import { Sparkles, Loader2, CheckCircle2, AlertCircle, X, HelpCircle } from 'lucide-react';
import { submitJob, updateJob, createAdminJob } from '../services/jobService';
import { CONTACT_EMAIL } from '../siteConfig';

interface SubmitJobFormProps {
  onSuccess: () => void;
  onOpenTerms: () => void;
  onOpenAdminDashboard?: () => void;
  initialData?: JobPosting;
  isAdminMode?: boolean;
  defaultSourceType?: JobSourceType;
}

type InputFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  required?: boolean;
  id?: string;
};

const InputField: React.FC<InputFieldProps> = ({ label, required, id, name, ...props }) => {
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
        {...props}
        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all text-sm placeholder:text-gray-400"
      />
    </div>
  );
};

type SelectFieldProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: string[];
  required?: boolean;
  id?: string;
};

const SelectField: React.FC<SelectFieldProps> = ({ label, required, options, id, name, ...props }) => {
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
        {...props}
        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all text-sm"
      >
        <option value="">Select...</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
};

const toDateTimeLocal = (isoDate?: string): string => {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  const timezoneOffsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
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
  const [scrapeToast, setScrapeToast] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  
  const jdInputRef = useRef<HTMLTextAreaElement>(null);
  const applyLinkId = useId();
  const jdTextId = useId();
  const cityId = useId();
  const cityListId = `major-cities-${cityId}`;
  const showAdminShortcut = Boolean(onOpenAdminDashboard);

  const scrollToTop = () => {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // JSDOM and some non-browser runtimes don't implement scrollTo.
    }
  };

  // Initial State
  const getInitialState = (sourceType: JobSourceType): Partial<JobPosting> => ({
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
    remotePolicy: RemotePolicy.ONSITE,
    sourceType,
    isVerified: sourceType === 'Direct',
    status: sourceType === 'Direct' ? 'pending' : 'active'
  });

  const [formData, setFormData] = useState<Partial<JobPosting>>(
      initialData || getInitialState(defaultSourceType)
  );

  const [submitterName, setSubmitterName] = useState(initialData?.submitterName || '');
  const [submitterEmail, setSubmitterEmail] = useState(initialData?.submitterEmail || '');
  const [postedDateInput, setPostedDateInput] = useState(toDateTimeLocal(initialData?.postedDate));

  // Auto-clear toast
  useEffect(() => {
    if (scrapeToast) {
      const timer = setTimeout(() => setScrapeToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [scrapeToast]);

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCountry = e.target.value;
    setFormData(prev => ({
      ...prev,
      locationCountry: newCountry,
      locationState: '' // Reset state
    }));
  };

  const handleLinkAutofill = async () => {
    if (!formData.externalLink) {
        setError("Please enter a link first.");
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

  const normalizeAIData = (data: Record<string, unknown>) => {
    // Important: pluck normalized keys out so `...rest` cannot overwrite them.
    const {
      employmentType,
      seniority,
      locationCountry: rawLocationCountry,
      remotePolicy: rawRemotePolicy,
      ...rest
    } = data;

    // Guard rails: AI must never override key submission fields like externalLink.
    // Only allow a narrow set of fields to be applied to the form.
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
        safeRest[key] = value;
        continue;
      }
      if (key === 'tags' && Array.isArray(value) && value.every((entry) => typeof entry === 'string')) {
        safeRest[key] = value;
      }
    }

    let locationCountry = typeof rawLocationCountry === 'string' ? rawLocationCountry : '';
    let remotePolicy = typeof rawRemotePolicy === 'string' ? rawRemotePolicy : '';
    let normalizedEmploymentType = typeof employmentType === 'string' ? employmentType : '';
    let normalizedSeniority = typeof seniority === 'string' ? seniority : '';

    // Strict Normalization for Dropdowns
    if (locationCountry === 'USA' || locationCountry === 'US') locationCountry = 'United States';
    if (locationCountry === 'UK' || locationCountry === 'Germany' || locationCountry === 'France') locationCountry = 'Europe';
    if (!COUNTRIES.includes(locationCountry)) locationCountry = 'Rest of World';

	    // Normalize Remote Policy
	    if (!Object.values(RemotePolicy).includes(remotePolicy as RemotePolicy)) {
	        if (remotePolicy?.toLowerCase().includes('remote')) remotePolicy = RemotePolicy.REMOTE;
	        else if (remotePolicy?.toLowerCase().includes('hybrid')) remotePolicy = RemotePolicy.HYBRID;
	        else remotePolicy = RemotePolicy.ONSITE;
	    }

	    // Normalize Employment Type (optional but must match enum if present)
	    if (!Object.values(EmploymentType).includes(normalizedEmploymentType as EmploymentType)) {
	      const lower = normalizedEmploymentType.toLowerCase();
	      if (lower.includes('full')) normalizedEmploymentType = EmploymentType.FULL_TIME;
	      else if (lower.includes('contract')) normalizedEmploymentType = EmploymentType.CONTRACT;
	      else if (lower.includes('intern')) normalizedEmploymentType = EmploymentType.INTERNSHIP;
	      else normalizedEmploymentType = '';
	    }

	    // Normalize Seniority (optional but must match enum if present)
	    if (!Object.values(SeniorityLevel).includes(normalizedSeniority as SeniorityLevel)) {
	      const lower = normalizedSeniority.toLowerCase();
	      if (lower.includes('junior') || lower === 'jr') normalizedSeniority = SeniorityLevel.JUNIOR;
	      else if (lower.includes('mid')) normalizedSeniority = SeniorityLevel.MID;
	      else if (lower.includes('senior') || lower === 'sr') normalizedSeniority = SeniorityLevel.SENIOR;
	      else if (lower.includes('lead') || lower.includes('staff') || lower.includes('principal')) normalizedSeniority = SeniorityLevel.LEAD;
	      else if (lower.includes('exec') || lower.includes('director') || lower.includes('vp')) normalizedSeniority = SeniorityLevel.EXECUTIVE;
	      else normalizedSeniority = '';
	    }

    return {
      ...safeRest,
      locationCountry,
      remotePolicy,
      employmentType: normalizedEmploymentType || undefined,
      seniority: normalizedSeniority || undefined
    };
  };

  const handleAIAnalysis = async () => {
    if (!jdText.trim()) return;

    setIsAnalyzing(true);
    setError(null);
    try {
      const rawAnalysis = await analyzeJobDescription(jdText) as Record<string, unknown> | null;
      if (rawAnalysis) {
        const normalized = normalizeAIData(rawAnalysis);
        setFormData((prev) => ({
          ...prev,
          ...normalized,
          intelligenceSummary: typeof rawAnalysis.summary === 'string' ? rawAnalysis.summary : prev.intelligenceSummary
        }));
      } else {
          setError("AI analysis failed. Please fill details manually.");
      }
    } catch {
      setError("Failed to analyze job description.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const sanitizePayloadForSubmit = (payload: Partial<JobPosting>): Partial<JobPosting> => {
    const cleaned: Record<string, unknown> = { ...payload };
    for (const [key, value] of Object.entries(cleaned)) {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        cleaned[key] = trimmed;
        if (trimmed === '' && key !== 'companyWebsite') {
          delete cleaned[key];
        }
      }
    }

    // Optional enums: only include if they match the known values.
    if (cleaned.remotePolicy && !Object.values(RemotePolicy).includes(cleaned.remotePolicy as RemotePolicy)) {
      delete cleaned.remotePolicy;
    }
    if (cleaned.employmentType && !Object.values(EmploymentType).includes(cleaned.employmentType as EmploymentType)) {
      delete cleaned.employmentType;
    }
    if (cleaned.seniority && !Object.values(SeniorityLevel).includes(cleaned.seniority as SeniorityLevel)) {
      delete cleaned.seniority;
    }

    // Tags must be a string[] (empty arrays are fine but don't add value).
    if (cleaned.tags && !Array.isArray(cleaned.tags)) {
      delete cleaned.tags;
    }
    if (Array.isArray(cleaned.tags) && cleaned.tags.length === 0) {
      delete cleaned.tags;
    }

    return cleaned as Partial<JobPosting>;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedSubmitterName = submitterName.trim();
    const trimmedSubmitterEmail = submitterEmail.trim();
    const trimmedExternalLink = (formData.externalLink || '').trim();
    const submitterRequiredMissing = !isAdminMode && (!trimmedSubmitterName || !trimmedSubmitterEmail);
    
    if (!formData.companyName?.trim() || 
        !formData.roleTitle?.trim() || 
        !trimmedExternalLink || 
        !formData.locationCountry || 
        !formData.locationCity?.trim() ||
        submitterRequiredMissing) {
      setError('Please fill in all mandatory fields.');
      scrollToTop();
      // Focus error for keyboard/screen reader users.
      setTimeout(() => errorRef.current?.focus(), 0);
      return;
    }

    setIsSubmitting(true);
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
	      scrollToTop();
	      setTimeout(() => successHeadingRef.current?.focus(), 0);
		    } catch (err) {
		      const message = err instanceof Error ? err.message : 'Failed to submit job. Please try again.';
		      setError(message);
		      scrollToTop();
		      setTimeout(() => errorRef.current?.focus(), 0);
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
		                      and include this ID.
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
    <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
      
      {/* Toast */}
      {scrapeToast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 w-[90%] md:w-auto animate-fade-in">
            <AlertCircle size={18} className="text-yellow-400 shrink-0" />
            <div className="text-sm font-medium">Auto-fill blocked by host. Please paste JD below.</div>
            <button type="button" onClick={() => setScrapeToast(false)} className="ml-auto hover:text-gray-300" aria-label="Close message"><X size={16} /></button>
        </div>
      )}

      <div className="p-6 border-b border-gray-100 bg-gray-50">
        <h2 className="text-xl font-bold text-gray-900 tracking-tight">
          {isEditing ? 'Edit Job' : (isAdminMode ? 'Create Job' : 'Post a Role')}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8">
	          {error && (
	            <div
	              ref={errorRef}
	              role="alert"
	              tabIndex={-1}
	              className="bg-red-50 text-red-700 p-3 rounded-lg text-sm font-medium border border-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
	            >
	              {error}
	            </div>
	          )}

          {!isAdminMode && (
            <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm border border-blue-100">
              Moderation note: community submissions are typically reviewed within 24 hours and may take up to 48 hours during high volume.
            </div>
          )}

          {/* Step 1: Link & Intelligence */}
          <section className="space-y-4">
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
		                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-600 outline-none transition-all text-base"
		                value={formData.externalLink || ''} 
		                onChange={(e) => setFormData((prev) => ({ ...prev, externalLink: e.target.value }))} 
		             />

	             {/* JD Paste Fallback */}
	             <div className="bg-white rounded-lg p-4 border border-gray-200 transition-colors">
	                <label htmlFor={jdTextId} className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
	                    Paste Job Description (Intelligence Engine)
	                </label>
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
          <section className="space-y-6">
            <h3 className="text-sm font-bold text-gray-900">2. Role Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
	                 <InputField label="Role Title" required value={formData.roleTitle || ''} onChange={(e) => setFormData((prev) => ({ ...prev, roleTitle: e.target.value }))} />
	              </div>
	
	              <InputField label="Company Name" required value={formData.companyName || ''} onChange={(e) => setFormData((prev) => ({ ...prev, companyName: e.target.value }))} />
	              <InputField label="Company Website" value={formData.companyWebsite || ''} onChange={(e) => setFormData((prev) => ({ ...prev, companyWebsite: e.target.value }))} />
	
	              <SelectField label="Remote Policy" required options={Object.values(RemotePolicy)} value={formData.remotePolicy || ''} onChange={(e) => setFormData((prev) => ({ ...prev, remotePolicy: e.target.value as RemotePolicy }))} />
	              <SelectField label="Employment Type" options={Object.values(EmploymentType)} value={formData.employmentType || ''} onChange={(e) => setFormData((prev) => ({ ...prev, employmentType: e.target.value as EmploymentType }))} />
	            </div>

            {/* Location Hierarchy */}
            <div className="bg-white p-5 rounded-lg border border-gray-200 space-y-4">
                 <h4 className="text-xs font-bold text-gray-500 uppercase">Location Hierarchy</h4>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <SelectField label="Country" required options={COUNTRIES} value={formData.locationCountry || ''} onChange={handleCountryChange} />
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
	                             list={cityListId}
	                             placeholder="Autocomplete..." 
	                             className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-600 outline-none text-sm"
	                             value={formData.locationCity || ''}
	                             onChange={(e) => setFormData((prev) => ({ ...prev, locationCity: e.target.value }))}
	                         />
	                         <datalist id={cityListId}>
	                             {MAJOR_CITIES.map(city => <option key={city} value={city} />)}
	                         </datalist>
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
              <section className="space-y-6">
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
          <section className="space-y-6">
              <h3 className="text-sm font-bold text-gray-900">
                {isAdminMode ? '4. Contact Info (Optional)' : '3. Contact Info (Private)'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <InputField
                  label="Your Name"
                  required={!isAdminMode}
                  value={submitterName}
                  onChange={e => setSubmitterName(e.target.value)}
                />
                <InputField
                  label="Your Email"
                  required={!isAdminMode}
                  type="email"
                  value={submitterEmail}
                  onChange={e => setSubmitterEmail(e.target.value)}
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
