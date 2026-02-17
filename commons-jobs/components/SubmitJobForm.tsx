
import React, { useState, useEffect, useId, useRef } from 'react';
import { EmploymentType, JobPosting, JobSourceType, RemotePolicy } from '../types';
import { COUNTRIES, PROVINCES, MAJOR_CITIES } from '../constants';
import { analyzeJobDescription } from '../services/geminiService';
import { Sparkles, Loader2, CheckCircle2, AlertCircle, X, HelpCircle } from 'lucide-react';
import { submitJob, updateJob, createAdminJob } from '../services/jobService';

interface SubmitJobFormProps {
  onSuccess: () => void;
  onOpenTerms: () => void;
  initialData?: JobPosting;
  isAdminMode?: boolean;
  defaultSourceType?: JobSourceType;
}

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
  initialData,
  isAdminMode = false,
  defaultSourceType = 'Direct' as JobSourceType
}) => {
  const isEditing = !!initialData;
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [jdText, setJdText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [scrapeToast, setScrapeToast] = useState(false);
  
  const jdInputRef = useRef<HTMLTextAreaElement>(null);

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
    const { employmentType, ...rest } = data;
    let locationCountry = typeof data.locationCountry === 'string' ? data.locationCountry : '';
    let remotePolicy = typeof data.remotePolicy === 'string' ? data.remotePolicy : '';

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

    return { locationCountry, remotePolicy, employmentType, ...rest };
  };

  const handleAIAnalysis = async () => {
    if (!jdText.trim()) return;

    setIsAnalyzing(true);
    setError(null);
    try {
      const rawAnalysis = await analyzeJobDescription(jdText) as Record<string, unknown> | null;
      if (rawAnalysis) {
        const normalized = normalizeAIData(rawAnalysis);
        setFormData(prev => ({
          ...prev,
          ...normalized,
          intelligenceSummary: rawAnalysis.summary // Map summary to intelligenceSummary
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const submitterRequiredMissing = !isAdminMode && (!submitterName || !submitterEmail);
    
    if (!formData.companyName || 
        !formData.roleTitle || 
        !formData.externalLink || 
        !formData.locationCountry || 
        !formData.locationCity ||
        submitterRequiredMissing) {
      setError("Please fill in all mandatory fields.");
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Partial<JobPosting> = {
        ...formData,
        sourceType: formData.sourceType || 'Direct',
        status: formData.status || (formData.sourceType === 'Aggregated' ? 'active' : 'pending')
      };

      if (submitterName) payload.submitterName = submitterName;
      if (submitterEmail) payload.submitterEmail = submitterEmail;
      
      if (isEditing && initialData) {
          await updateJob({ ...initialData, ...payload } as JobPosting);
      } else if (isAdminMode) {
          await createAdminJob(payload as Parameters<typeof createAdminJob>[0]);
      } else {
          await submitJob(payload as Parameters<typeof submitJob>[0]); 
      }
      
      setIsSubmitted(true);
      if (!isEditing) {
         onSuccess();
      }
    } catch {
      setError("Failed to submit job. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const InputField = ({ label, required, id, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => {
    const autoId = useId();
    const inputId = id || `field-${autoId}`;

    return (
      <div className="space-y-1">
        <label htmlFor={inputId} className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <input
          id={inputId}
          name={props.name || inputId}
          required={required}
          {...props}
          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all text-sm placeholder:text-gray-400"
        />
      </div>
    );
  };

  const SelectField = ({
    label,
    required,
    options,
    id,
    ...props
  }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: string[] }) => {
    const autoId = useId();
    const selectId = id || `field-${autoId}`;

    return (
      <div className="space-y-1">
        <label htmlFor={selectId} className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <select
          id={selectId}
          name={props.name || selectId}
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

  if (isSubmitted) {
      return (
          <div className="max-w-xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center mt-8">
              <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={24} />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                {isEditing ? 'Changes Saved' : (isAdminMode ? 'Job Created' : 'Submission Received')}
              </h2>
              <p className="text-gray-500 mb-6 text-sm">
                  {isEditing
                    ? 'Your job posting has been successfully updated.'
                    : (isAdminMode ? 'The posting has been added to the board.' : 'Your post is now in the review queue.')}
              </p>
              <button 
                type="button"
                onClick={isEditing ? onSuccess : () => { 
                    setIsSubmitted(false); 
                    setFormData(getInitialState(defaultSourceType)); 
                    setPostedDateInput('');
                    setJdText('');
                }} 
                className="text-sm font-bold text-blue-600 hover:text-blue-800"
              >
                  {isEditing ? 'Back to Dashboard' : (isAdminMode ? 'Create Another Job' : 'Submit Another Role')}
              </button>
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
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm font-medium border border-red-100">
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
                <label className="block text-sm font-bold text-gray-900">
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
                required 
                type="url" 
                placeholder="https://company.com/jobs/..." 
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-600 outline-none transition-all text-base"
                value={formData.externalLink} 
                onChange={e => setFormData({...formData, externalLink: e.target.value})} 
             />

             {/* JD Paste Fallback */}
             <div className="bg-white rounded-lg p-4 border border-gray-200 transition-colors">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                    Paste Job Description (Intelligence Engine)
                </label>
                <textarea
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
                 <InputField label="Role Title" required value={formData.roleTitle} onChange={e => setFormData({...formData, roleTitle: e.target.value})} />
              </div>

              <InputField label="Company Name" required value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} />
              <InputField label="Company Website" value={formData.companyWebsite} onChange={e => setFormData({...formData, companyWebsite: e.target.value})} />

              <SelectField label="Remote Policy" required options={Object.values(RemotePolicy)} value={formData.remotePolicy || ''} onChange={e => setFormData({...formData, remotePolicy: e.target.value as RemotePolicy})} />
              <SelectField label="Employment Type" options={Object.values(EmploymentType)} value={formData.employmentType || ''} onChange={e => setFormData({...formData, employmentType: e.target.value as EmploymentType})} />
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
                        onChange={e => setFormData({...formData, locationState: e.target.value})} 
                        disabled={!formData.locationCountry}
                     />
                     <div className="space-y-1">
                         <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">City <span className="text-red-500">*</span></label>
                         <input 
                             required
                             type="text" 
                             list="major-cities"
                             placeholder="Autocomplete..." 
                             className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-600 outline-none text-sm"
                             value={formData.locationCity || ''}
                             onChange={e => setFormData({...formData, locationCity: e.target.value})}
                         />
                         <datalist id="major-cities">
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
                    onChange={e => setFormData({...formData, intelligenceSummary: e.target.value})} 
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
                    onChange={e => setFormData({ ...formData, externalSource: e.target.value })}
                    placeholder="LinkedIn, Workday, Company Careers"
                  />
                  <SelectField
                    label="Verification"
                    required
                    options={['Verified', 'Unverified']}
                    value={(formData.isVerified ?? true) ? 'Verified' : 'Unverified'}
                    onChange={e => setFormData({ ...formData, isVerified: e.target.value === 'Verified' })}
                  />
                  <SelectField
                    label="Status"
                    required
                    options={['pending', 'active', 'rejected', 'archived']}
                    value={formData.status || 'pending'}
                    onChange={e => setFormData({ ...formData, status: e.target.value as JobPosting['status'] })}
                  />
                  <InputField
                    label="Posted Date"
                    type="datetime-local"
                    value={postedDateInput}
                    onChange={e => {
                      const localDate = e.target.value;
                      setPostedDateInput(localDate);
                      setFormData({
                        ...formData,
                        postedDate: localDate ? new Date(localDate).toISOString() : undefined
                      });
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
