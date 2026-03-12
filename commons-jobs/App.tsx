
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Header from './components/Header';
import JobFilters from './components/JobFilters';
import JobCard from './components/JobCard';
import { JobFilterState, JobPosting, JobSearchFacets, JobSortOption } from './types';
import { getJobs, getJobById, adminLogin, adminLogout, refreshAdminSession } from './services/jobService';
import { CONTACT_EMAIL } from './siteConfig';
import { Loader2, Lock, ChevronDown, Hexagon, X, Filter, Globe, Users, MessageSquare, ShieldCheck, RefreshCcw } from 'lucide-react';
import { buildFeedbackMailto } from './utils/feedbackMailto';

const SubmitJobForm = React.lazy(() => import('./components/SubmitJobForm'));
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard'));
const DataTerms = React.lazy(() => import('./components/DataTerms'));
const WhyWhoWhat = React.lazy(() => import('./components/WhyWhoWhat'));
const FAQ = React.lazy(() => import('./components/FAQ'));
const JobDetailModal = React.lazy(() => import('./components/JobDetailModal'));

const DEFAULT_FACETS: JobSearchFacets = {
  remotePolicies: { Onsite: 0, Hybrid: 0, Remote: 0 },
  employmentTypes: { 'Full-time': 0, Contract: 0, Internship: 0 },
  seniorityLevels: { Junior: 0, 'Mid-Level': 0, Senior: 0, Lead: 0, Executive: 0 }
};
const FOUNDER_NOTE_COLLAPSED_KEY = 'commons_jobs_founder_note_collapsed_v1';

type AggregatedPolicySummary = {
  aggregatedPolicyApplied: boolean;
  companyCapApplied: boolean;
  aggregatedCounts: { beforePolicy: number; afterPolicy: number };
  policy: { country: 'Canada'; maxAgeDays: number; maxResults: number; maxPerCompany: number } | null;
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'browse' | 'submit' | 'admin' | 'terms' | 'about' | 'faq'>('browse');
  
  // Feed State
  const [feedType, setFeedType] = useState<'direct' | 'aggregated'>('direct');
  
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [totalJobs, setTotalJobs] = useState(0);
  const [facets, setFacets] = useState<JobSearchFacets>(DEFAULT_FACETS);
  const [companyCapApplied, setCompanyCapApplied] = useState(false);
  const [aggregatedPolicySummary, setAggregatedPolicySummary] = useState<AggregatedPolicySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
	  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Mobile UX State
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Modal State
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);
  const adminModalRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const [founderNoteExpanded, setFounderNoteExpanded] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      return window.localStorage.getItem(FOUNDER_NOTE_COLLAPSED_KEY) !== '1';
    } catch {
      return true;
    }
  });

  const [filters, setFilters] = useState<JobFilterState>({
    keyword: '',
    remotePolicies: [],
    seniorityLevels: [], 
    employmentTypes: [],
    locations: [],
    dateRange: 'all',
    sort: 'newest',
    page: 1,
    pageSize: 30
  });

  // URL Sync
  useEffect(() => {
    let active = true;
    void (async () => {
      const authenticated = await refreshAdminSession();
      if (active) setIsAdmin(authenticated);
    })();

    // 1. Parse URL params on mount
    const params = new URLSearchParams(window.location.search);
    const jobId = params.get('jobId');
    const feed = params.get('feed');

    if (feed === 'aggregated') {
        setFeedType('aggregated');
    }

    if (jobId) {
        // Fetch specific job regardless of filter to support direct linking
        void (async () => {
          const job = await getJobById(jobId);
          if (job) setSelectedJob(job);
        })();
    }
    return () => {
      active = false;
    };
  }, []);

  // Update URL when filters/job/feed changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.keyword) params.set('keyword', filters.keyword);
    if (selectedJob) params.set('jobId', selectedJob.id);
    if (feedType === 'aggregated') params.set('feed', 'aggregated');
    
    // Keep URL state in sync without growing browser history on each UI state change.
    const url = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.replaceState({}, '', url);

    // Update Page Title
    if (selectedJob) {
        document.title = `${selectedJob.roleTitle} @ ${selectedJob.companyName} | Commons Jobs`;
    } else if (filters.keyword) {
        document.title = `${filters.keyword} Jobs | Commons Jobs`;
    } else {
        document.title = 'Commons Jobs | Fintech Commons';
    }

  }, [filters.keyword, selectedJob, feedType]);

  const activeFilterCount = useMemo(
    () => filters.remotePolicies.length + filters.employmentTypes.length + filters.seniorityLevels.length,
    [filters.employmentTypes.length, filters.remotePolicies.length, filters.seniorityLevels.length]
  );
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalJobs / Math.max(1, filters.pageSize))),
    [filters.pageSize, totalJobs]
  );

  const activeFilterPills = useMemo(() => {
    const pills: Array<{ key: string; label: string; onRemove: () => void }> = [];
    filters.remotePolicies.forEach((value) =>
      pills.push({
        key: `remote-${value}`,
        label: value,
        onRemove: () =>
          setFilters((prev) => ({ ...prev, remotePolicies: prev.remotePolicies.filter((entry) => entry !== value), page: 1 }))
      })
    );
    filters.employmentTypes.forEach((value) =>
      pills.push({
        key: `employment-${value}`,
        label: value,
        onRemove: () =>
          setFilters((prev) => ({ ...prev, employmentTypes: prev.employmentTypes.filter((entry) => entry !== value), page: 1 }))
      })
    );
    filters.seniorityLevels.forEach((value) =>
      pills.push({
        key: `seniority-${value}`,
        label: value,
        onRemove: () =>
          setFilters((prev) => ({ ...prev, seniorityLevels: prev.seniorityLevels.filter((entry) => entry !== value), page: 1 }))
      })
    );
    return pills;
  }, [filters.employmentTypes, filters.remotePolicies, filters.seniorityLevels]);

  const feedbackHref = useMemo(() => {
    const activeFilters = [
      ...filters.remotePolicies,
      ...filters.employmentTypes,
      ...filters.seniorityLevels,
      ...(filters.dateRange !== 'all' ? [`Date: ${filters.dateRange}`] : [])
    ];
    return buildFeedbackMailto({
      pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
      feedType,
      sort: filters.sort,
      keyword: filters.keyword,
      activeFilters
    });
  }, [feedType, filters.dateRange, filters.employmentTypes, filters.keyword, filters.remotePolicies, filters.seniorityLevels, filters.sort]);

  const toggleFounderNote = () => {
    setFounderNoteExpanded((prev) => {
      const next = !prev;
      if (!next) {
        try {
          window.localStorage.setItem(FOUNDER_NOTE_COLLAPSED_KEY, '1');
        } catch {
          // Ignore storage write issues.
        }
      }
      return next;
    });
  };

  useEffect(() => {
    if (!showAdminLogin) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setShowAdminLogin(false);
        return;
      }
      if (event.key !== 'Tab' || !adminModalRef.current) return;

      const focusable = Array.from(
        adminModalRef.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      );
      const focusableElements = focusable.filter(
        (element): element is HTMLElement =>
          element instanceof HTMLElement &&
          !element.hasAttribute('disabled') &&
          !element.getAttribute('aria-hidden')
      );

      if (focusableElements.length === 0) return;
      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (!active || active === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [showAdminLogin]);

  useEffect(() => {
    if (currentView === 'browse') {
      const controller = new AbortController();

      const fetchJobs = async () => {
        setLoading(true);
        setLoadError(null);
        try {
          const data = await getJobs(filters, feedType, controller.signal);
          setJobs(data.jobs);
          setTotalJobs(data.total);
          setFacets(data.facets);
          setCompanyCapApplied(Boolean(data.meta?.companyCapApplied));
          setAggregatedPolicySummary(feedType === 'aggregated' ? (data.meta || null) : null);
          setLastLoadedAt(new Date());
        } catch (error) {
          if (controller.signal.aborted) return;
          console.error(error);
          setLoadError('Unable to load roles right now. Please try again.');
          setAggregatedPolicySummary(null);
        } finally {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        }
      };

      void fetchJobs();
      return () => controller.abort();
    }
  }, [filters, currentView, feedType, reloadNonce]);

  const handleSelectJob = useCallback((job: JobPosting) => {
    lastActiveElementRef.current = (document.activeElement as HTMLElement) || null;
    setSelectedJob(job);
  }, []);

  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const success = await adminLogin(adminUsername, adminPassword);
      if (success) {
        setIsAdmin(true);
        setShowAdminLogin(false);
        setCurrentView('admin');
        setAdminPassword('');
      } else {
        setLoginError('Invalid credentials');
      }
    } catch {
      setLoginError('Login failed');
    }
  };

  const handleAdminLogout = async () => {
    await adminLogout();
    setIsAdmin(false);
    setCurrentView('browse');
  };

  const renderContent = () => {
    if (currentView === 'admin' && isAdmin) {
      return <AdminDashboard />;
    }
    if (currentView === 'terms') {
      return <DataTerms onBack={() => setCurrentView('browse')} />;
    }
    if (currentView === 'about') {
      return <WhyWhoWhat onBack={() => setCurrentView('browse')} />;
    }
    if (currentView === 'faq') {
      return <FAQ onBack={() => setCurrentView('browse')} />;
    }
	    if (currentView === 'submit') {
	      return (
	        <SubmitJobForm
	          onSuccess={() => setCurrentView('browse')}
	          onOpenTerms={() => setCurrentView('terms')}
	          onOpenAdminDashboard={isAdmin ? () => setCurrentView('admin') : undefined}
	        />
	      );
	    }
    
    // Browse View
    return (
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[330px_minmax(0,1fr)] xl:gap-8">
        <aside className="w-full self-start lg:sticky lg:top-28">
          <button
            type="button"
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="cj-glass mb-3 flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-[var(--cj-text-primary)] md:hidden"
            aria-expanded={showMobileFilters}
            aria-controls="browse-filters-panel"
          >
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-[var(--cj-text-muted)]" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--cj-accent)] px-1.5 text-[10px] font-bold text-[var(--cj-accent-navy)]">
                  {activeFilterCount}
                </span>
              )}
            </div>
            <ChevronDown size={16} className={`text-[var(--cj-text-muted)] transition-premium ${showMobileFilters ? 'rotate-180' : ''}`} />
          </button>

          <div
            id="browse-filters-panel"
            className={`${showMobileFilters ? 'block' : 'hidden'} md:block animate-slide-up md:animate-none lg:max-h-[calc(100vh-7.25rem)] lg:overflow-y-auto lg:pr-1`}
          >
            <div className="cj-glass p-4 md:p-5">
              <JobFilters filters={filters} facets={facets} setFilters={setFilters} />
            </div>

            <div className="cj-glass mt-4 p-4">
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--cj-text-muted)]">Admin & Info</h3>
              <div className="flex flex-col items-start gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentView('terms')}
                  className="text-left text-xs font-medium text-[var(--cj-text-secondary)] transition-premium hover:text-[var(--cj-accent-strong)] focus-visible:focus-ring"
                >
                  Data, Terms & Common Sense
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentView('about')}
                  className="text-left text-xs font-medium text-[var(--cj-text-secondary)] transition-premium hover:text-[var(--cj-accent-strong)] focus-visible:focus-ring"
                >
                  Why, Who, & What
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentView('faq')}
                  className="text-left text-xs font-medium text-[var(--cj-text-secondary)] transition-premium hover:text-[var(--cj-accent-strong)] focus-visible:focus-ring"
                >
                  FAQ
                </button>
                {isAdmin ? (
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setCurrentView('admin')}
                      className="text-xs font-semibold text-[var(--cj-text-primary)] transition-premium hover:text-[var(--cj-accent-strong)] focus-visible:focus-ring"
                    >
                      Admin Dashboard
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleAdminLogout()}
                      className="text-xs font-semibold text-[var(--cj-text-muted)] transition-premium hover:text-[var(--cj-text-secondary)] focus-visible:focus-ring"
                    >
                      Logout
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAdminLogin(true)}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--cj-text-secondary)] transition-premium hover:text-[var(--cj-text-primary)] focus-visible:focus-ring"
                  >
                    <Lock size={12} />
                    Admin Login
                  </button>
                )}
              </div>
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          <div className="cj-glass mb-5 inline-flex p-1">
            <button
              type="button"
              onClick={() => {
                setFeedType('direct');
                setFilters((prev) => ({ ...prev, page: 1 }));
              }}
              className={`inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-sm font-semibold transition-premium focus-visible:focus-ring ${
                feedType === 'direct' ? 'bg-[var(--cj-accent-navy)] text-white' : 'text-[var(--cj-text-secondary)] hover:bg-[#f5f8fb]'
              }`}
              aria-pressed={feedType === 'direct'}
            >
              <Users size={16} />
              Community Board
            </button>
            <button
              type="button"
              onClick={() => {
                setFeedType('aggregated');
                setFilters((prev) => ({
                  ...prev,
                  page: 1,
                  sort: prev.sort === 'most_clicked' ? 'newest' : prev.sort
                }));
              }}
              className={`inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-sm font-semibold transition-premium focus-visible:focus-ring ${
                feedType === 'aggregated' ? 'bg-[var(--cj-accent)] text-[var(--cj-accent-navy)]' : 'text-[var(--cj-text-secondary)] hover:bg-[#f5f8fb]'
              }`}
              aria-pressed={feedType === 'aggregated'}
            >
              <Globe size={16} />
              Web Pulse 🇨🇦
            </button>
          </div>

          <div className="cj-glass relative mb-5 animate-fade-in overflow-hidden p-4 md:p-5">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-0 top-0 h-24 w-40 rounded-bl-[2rem] bg-[radial-gradient(circle_at_top_right,rgba(53,206,184,0.22),transparent_70%)]"
            />
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--cj-text-muted)]">
                  {feedType === 'direct' ? 'Trusted Community Roles' : 'Canada Market Pulse'}
                </p>
                <h2 className="mt-1 text-lg font-semibold tracking-[-0.01em] text-[var(--cj-text-primary)]">
                  {feedType === 'direct' ? 'Human-submitted fintech and banking roles' : 'Recent Canadian banking + fintech roles'}
                </h2>
                <p className="mt-1 text-sm text-[var(--cj-text-secondary)]">
                  {feedType === 'direct'
                    ? 'These are reviewed submissions from the Commons network where warm intros may be possible.'
                    : 'Web Pulse is policy-filtered: Canada only, up to 12 days old, max 50 roles, max 5 roles per company.'}
                </p>
                <p className="mt-2 text-xs font-medium text-[var(--cj-text-muted)]">
                  {loading
                    ? 'Refreshing…'
                    : `${totalJobs} role${totalJobs === 1 ? '' : 's'} loaded${lastLoadedAt ? ` · Updated ${lastLoadedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}`}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full border border-[#d6ece8] bg-[#f1fbf9] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#0f766e]">
                    {feedType === 'direct' ? 'Community reviewed' : 'Policy filtered'}
                  </span>
                  <span className="rounded-full border border-[var(--cj-stroke-soft)] bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--cj-text-muted)]">
                    {feedType === 'direct' ? 'Warm intros available' : 'Canada only'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReloadNonce((prev) => prev + 1)}
                  className="inline-flex items-center gap-1.5 rounded-[12px] border border-[var(--cj-stroke-soft)] bg-white px-3 py-2 text-xs font-semibold text-[var(--cj-text-secondary)] transition-premium hover:border-[var(--cj-stroke-strong)] hover:text-[var(--cj-text-primary)] focus-visible:focus-ring"
                >
                  <RefreshCcw size={13} />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentView('submit')}
                  className="inline-flex items-center gap-1.5 rounded-[12px] border border-[var(--cj-accent-navy)] bg-[var(--cj-accent-navy)] px-3 py-2 text-xs font-semibold text-white transition-premium hover:opacity-90 focus-visible:focus-ring"
                >
                  Post Role
                </button>
              </div>
            </div>
          </div>

          <div className="cj-glass sticky top-[6.1rem] z-20 mb-5 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <label htmlFor="sort-jobs" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--cj-text-muted)]">
                  Sort
                </label>
                <select
                  id="sort-jobs"
                  className="rounded-[12px] border border-[var(--cj-stroke-soft)] bg-white px-3 py-2 text-sm font-medium text-[var(--cj-text-secondary)] focus-visible:focus-ring"
                  value={filters.sort}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, sort: event.target.value as JobSortOption, page: 1 }))
                  }
                >
                  <option value="newest">Newest</option>
                  <option value="most_clicked" disabled={feedType === 'aggregated'}>
                    Most clicked{feedType === 'aggregated' ? ' (Direct only)' : ''}
                  </option>
                  <option value="company_az">Company A-Z</option>
                </select>
              </div>
              <a
                href={feedbackHref}
                className="inline-flex items-center gap-2 rounded-[12px] border border-[var(--cj-stroke-soft)] bg-white px-3 py-2 text-xs font-semibold text-[var(--cj-text-secondary)] transition-premium hover:border-[var(--cj-stroke-strong)] hover:text-[var(--cj-text-primary)] focus-visible:focus-ring"
              >
                <MessageSquare size={14} />
                Send feedback
              </a>
            </div>
            {activeFilterPills.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {activeFilterPills.map((pill) => (
                  <button
                    key={pill.key}
                    type="button"
                    onClick={pill.onRemove}
                    className="inline-flex items-center gap-1 rounded-full border border-[#cdece8] bg-[#f4fbfa] px-2.5 py-1 text-xs font-semibold text-[#0b5f58] transition-premium focus-visible:focus-ring"
                  >
                    {pill.label}
                    <X size={12} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {feedType === 'aggregated' && (
            <div className="cj-surface-tinted animate-fade-in mb-6 flex items-start gap-3 p-4 text-sm text-[#0f5f59]">
              <Globe size={18} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-[var(--cj-text-primary)]">Automated Canadian Fintech Feed</p>
                <p className="text-[var(--cj-text-secondary)]">
                  This feed pulls public listings from major Canadian banks and fintechs posted in the last 12 days. These are not manually verified by the Commons.
                </p>
                <p className="mt-1 text-xs font-semibold text-[var(--cj-text-secondary)]">
                  Policy: Canada only, max 12 days, max 50 jobs, max 5 active roles per company.
                </p>
                {companyCapApplied && <p className="mt-1 text-xs text-[var(--cj-text-secondary)]">Repeated companies were trimmed in this result set.</p>}
                {aggregatedPolicySummary?.policy && (
                  <p className="mt-1 text-xs text-[var(--cj-text-secondary)]">
                    Policy filter kept {aggregatedPolicySummary.aggregatedCounts.afterPolicy} of {aggregatedPolicySummary.aggregatedCounts.beforePolicy} roles in this search.
                  </p>
                )}
              </div>
            </div>
          )}

          <section className="cj-glass mb-6 p-4 md:p-5">
            <button
              type="button"
              onClick={toggleFounderNote}
              className="mb-3 inline-flex w-full items-center justify-between rounded-[12px] border border-[var(--cj-stroke-soft)] bg-white px-3 py-2 text-left text-sm font-semibold text-[var(--cj-text-primary)] transition-premium focus-visible:focus-ring"
              aria-expanded={founderNoteExpanded}
            >
              <span>Why I built Commons Jobs</span>
              <ChevronDown size={16} className={`transition-premium ${founderNoteExpanded ? 'rotate-180' : ''}`} />
            </button>

            {founderNoteExpanded && (
              <p className="mb-4 max-w-[72ch] text-sm leading-relaxed text-[var(--cj-text-secondary)]">
                Hi, it&apos;s Tarique 👋 Job boards were built to solve a real problem. They made finding work easier for both employees and employers. They did that really well. So well that now they&apos;re noisy. Everyone&apos;s on them, everything&apos;s on them, and signal gets buried. I noticed something else. Word of mouth works in fintech. The community is tight. But it doesn&apos;t scale beyond who you personally know. I thought about what AI and verticalization could do here. Slice things differently. Build infrastructure specific to a community instead of generic. That&apos;s what this is.
              </p>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="cj-surface-elevated p-3.5">
                <p className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--cj-text-primary)]">
                  <ShieldCheck size={13} />
                  Community Board
                </p>
                <p className="text-xs leading-relaxed text-[var(--cj-text-secondary)]">
                  People in the industry submit roles directly to me. If you know someone hiring, send me the role and I&apos;ll get it posted.
                </p>
              </div>
              <div className="cj-surface-elevated p-3.5">
                <p className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--cj-text-primary)]">
                  <Globe size={13} />
                  Web Pulse
                </p>
                <p className="text-xs leading-relaxed text-[var(--cj-text-secondary)]">Raw market feed curated from the internet. Canada only, last 12 days.</p>
              </div>
            </div>

            <div className="mt-3 rounded-[12px] border border-[var(--cj-stroke-soft)] bg-white/88 px-3 py-2 text-xs leading-relaxed text-[var(--cj-text-secondary)]">
              <span className="font-semibold text-[var(--cj-text-primary)]">Please note:</span> This is pre-alpha. I&apos;m learning as I build. If something doesn&apos;t work or you have feedback, let me know. Seriously.
            </div>
          </section>

          {loading ? (
            <div className="jobs-grid grid gap-4 xl:gap-5" role="status" aria-live="polite">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={`skeleton-${idx}`} className="cj-surface-elevated p-6">
                  <div className="mb-4 flex items-start justify-between">
                    <div className="skeleton-shimmer h-12 w-12 rounded-[12px]" />
                    <div className="skeleton-shimmer h-6 w-24 rounded-full" />
                  </div>
                  <div className="skeleton-shimmer mb-2 h-5 w-4/5 rounded-md" />
                  <div className="skeleton-shimmer mb-4 h-4 w-1/2 rounded-md" />
                  <div className="skeleton-shimmer mb-4 h-4 w-3/4 rounded-md" />
                  <div className="skeleton-shimmer h-24 rounded-[12px]" />
                </div>
              ))}
            </div>
          ) : loadError ? (
            <div className="cj-glass border-red-200 bg-red-50/90 p-8 text-center text-red-700" role="alert">
              <p className="mb-3 font-semibold">{loadError}</p>
              <p className="mb-4 text-sm text-red-600">Try refreshing this feed, or switch feeds while we retry upstream calls.</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setReloadNonce((prev) => prev + 1)}
                  className="rounded-[12px] bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-premium hover:bg-red-700 focus-visible:focus-ring"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFeedType((prev) => (prev === 'direct' ? 'aggregated' : 'direct'));
                    setFilters((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="rounded-[12px] border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition-premium hover:bg-red-100 focus-visible:focus-ring"
                >
                  Switch Feed
                </button>
              </div>
            </div>
          ) : jobs.length === 0 ? (
            <div className="cj-glass border-dashed border-[var(--cj-stroke-strong)] bg-[var(--cj-surface-base)]/92 px-6 py-14 text-center text-[var(--cj-text-muted)]">
              <p className="mb-2 text-base font-semibold text-[var(--cj-text-secondary)]">
                No {feedType === 'aggregated' ? 'Canadian ' : ''}opportunities found for these filters.
              </p>
              <p className="mb-5 text-sm">Clear filters or switch feeds to widen results.</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      remotePolicies: [],
                      seniorityLevels: [],
                      employmentTypes: [],
                      page: 1
                    }))
                  }
                  className="rounded-[12px] border border-[var(--cj-stroke-soft)] bg-white px-4 py-2 text-sm font-semibold text-[var(--cj-text-secondary)] transition-premium hover:border-[var(--cj-stroke-strong)] focus-visible:focus-ring"
                >
                  Clear Filters
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFeedType((prev) => (prev === 'direct' ? 'aggregated' : 'direct'));
                    setFilters((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="rounded-[12px] border border-[var(--cj-accent)] bg-[#ecfaf8] px-4 py-2 text-sm font-semibold text-[var(--cj-accent-strong)] transition-premium hover:bg-[#dff5f1] focus-visible:focus-ring"
                >
                  Switch Feed
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="jobs-grid grid gap-4 xl:gap-5 animate-slide-up" aria-live="polite" aria-busy={loading}>
                {jobs.map((job) => (
                  <JobCard key={job.id} job={job} onSelect={handleSelectJob} />
                ))}
              </div>
              {totalPages > 1 && (
                <div className="cj-glass mt-6 flex items-center justify-between px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    disabled={filters.page <= 1}
                    className="rounded-[12px] border border-[var(--cj-stroke-soft)] px-3 py-1.5 text-sm font-semibold text-[var(--cj-text-secondary)] transition-premium hover:border-[var(--cj-stroke-strong)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <div className="text-sm text-[var(--cj-text-secondary)]">
                    Page {filters.page} of {totalPages} · {totalJobs} roles
                  </div>
                  <button
                    type="button"
                    onClick={() => setFilters((prev) => ({ ...prev, page: Math.min(totalPages, prev.page + 1) }))}
                    disabled={filters.page >= totalPages}
                    className="rounded-[12px] border border-[var(--cj-stroke-soft)] px-3 py-1.5 text-sm font-semibold text-[var(--cj-text-secondary)] transition-premium hover:border-[var(--cj-stroke-strong)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    );
  };

  return (
    <div className="relative flex min-h-screen flex-col font-sans text-[var(--cj-text-primary)]">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-40 top-14 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(53,206,184,0.2),transparent_70%)]" />
        <div className="absolute right-[-7rem] top-[-3rem] h-[23rem] w-[23rem] rounded-full bg-[radial-gradient(circle,rgba(85,117,200,0.16),transparent_70%)]" />
      </div>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[90] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-[var(--cj-text-primary)] focus:shadow"
      >
        Skip to main content
      </a>
      
      <Header currentView={currentView === 'submit' ? 'submit' : 'browse'} setCurrentView={setCurrentView} />

      {/* Modal - Render at root */}
      {selectedJob && (
        <Suspense fallback={null}>
          <JobDetailModal 
            job={selectedJob} 
            onClose={() => {
              setSelectedJob(null);
              setTimeout(() => lastActiveElementRef.current?.focus(), 0);
            }} 
          />
        </Suspense>
      )}

      {/* Admin Login Modal */}
      {showAdminLogin && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4" onClick={() => setShowAdminLogin(false)}>
            <div
                ref={adminModalRef}
                className="w-full max-w-sm rounded-[16px] border border-[var(--cj-stroke-soft)] bg-white p-8 shadow-[var(--cj-shadow-elevated)]"
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-login-title"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-6">
                    <h3 id="admin-login-title" className="text-lg font-semibold text-[var(--cj-text-primary)]">Admin Access</h3>
                    <button type="button" onClick={() => setShowAdminLogin(false)} className="rounded-full p-1 text-[var(--cj-text-muted)] transition-premium hover:text-[var(--cj-text-secondary)] focus-visible:focus-ring" aria-label="Close admin login dialog">
                        <ChevronDown className="rotate-180" size={20} />
                    </button>
                </div>
                <form onSubmit={handleAdminLoginSubmit}>
                    <label htmlFor="admin-username" className="sr-only">Username</label>
                    <input 
                        id="admin-username"
                        type="text" 
                        placeholder="Username" 
                        className="mb-3 w-full rounded-[12px] border border-[var(--cj-stroke-soft)] bg-white p-3 text-[var(--cj-text-primary)] outline-none transition-premium focus-visible:focus-ring"
                        value={adminUsername}
                        onChange={e => setAdminUsername(e.target.value)}
                        autoComplete="username"
                        autoFocus
                        required
                    />
                    <label htmlFor="admin-password" className="sr-only">Password</label>
                    <input 
                        id="admin-password"
                        type="password" 
                        placeholder="Password" 
                        className="mb-4 w-full rounded-[12px] border border-[var(--cj-stroke-soft)] bg-white p-3 text-[var(--cj-text-primary)] outline-none transition-premium focus-visible:focus-ring"
                        value={adminPassword}
                        onChange={e => setAdminPassword(e.target.value)}
                        autoComplete="current-password"
                        required
                    />
                    {loginError && <p className="mb-4 text-xs text-red-600" role="alert">{loginError}</p>}
                    <button type="submit" className="w-full rounded-[12px] bg-[var(--cj-accent-navy)] py-3 text-sm font-semibold text-white transition-premium hover:opacity-95 focus-visible:focus-ring">
                        Login
                    </button>
                </form>
            </div>
        </div>
      )}

      <main id="main-content" className="w-full max-w-[1720px] flex-grow px-4 py-10 sm:px-6 lg:mx-auto lg:px-8">
        <Suspense
          fallback={
            <div className="flex flex-col items-center gap-3 py-20 text-center text-[var(--cj-text-muted)]" role="status" aria-live="polite">
              <Loader2 className="animate-spin text-[#9fb0be]" size={32} />
              <span>Loading…</span>
            </div>
          }
        >
          {renderContent()}
        </Suspense>
      </main>

      <footer className="mt-16 border-t border-[var(--cj-stroke-soft)] bg-white/88 py-12 backdrop-blur-sm">
        <div className="mx-auto max-w-[1720px] space-y-6 px-4 text-center">
          <div className="flex items-center justify-center gap-3 text-lg font-semibold tracking-tight text-[var(--cj-accent-navy)]">
             <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--cj-accent-navy)] shadow-[0_8px_20px_rgba(11,19,43,0.24)]">
               <Hexagon size={19} strokeWidth={2.3} className="text-[var(--cj-accent)]" />
               <span className="absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full border border-white bg-[var(--cj-accent)]" />
             </span>
             Commons Jobs
          </div>
          <p className="text-sm text-[var(--cj-text-secondary)]">Curated opportunities for the next generation of finance.</p>
          
          <div className="flex flex-wrap justify-center gap-6 text-sm font-medium text-[var(--cj-text-secondary)]">
             <button type="button" onClick={() => setCurrentView('terms')} className="transition-premium hover:text-[var(--cj-accent-strong)] focus-visible:focus-ring">
                Data, Terms & Common Sense
            </button>
            <button type="button" onClick={() => setCurrentView('about')} className="transition-premium hover:text-[var(--cj-accent-strong)] focus-visible:focus-ring">
                Why, Who, & What
            </button>
            <button type="button" onClick={() => setCurrentView('faq')} className="transition-premium hover:text-[var(--cj-accent-strong)] focus-visible:focus-ring">
                FAQ
            </button>
          </div>

		          <div className="pt-4 max-w-xl mx-auto">
		             <p className="text-xs text-[var(--cj-text-secondary)]">
		                Email{' '}
		                <a
		                  href={`mailto:${CONTACT_EMAIL}`}
		                  className="text-[var(--cj-accent-strong)] underline underline-offset-2 transition-premium hover:opacity-80 focus-visible:focus-ring"
		                >
		                  {CONTACT_EMAIL}
		                </a>{' '}
		                for edits or takedowns.{' '}
		                <a
		                  href={feedbackHref}
		                  className="text-[var(--cj-text-primary)] underline underline-offset-2 transition-premium hover:text-[var(--cj-accent-navy)] focus-visible:focus-ring"
		                >
		                  Send beta feedback
		                </a>
		             </p>
		          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
