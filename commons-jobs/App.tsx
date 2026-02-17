
import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import JobFilters from './components/JobFilters';
import JobCard from './components/JobCard';
import SubmitJobForm from './components/SubmitJobForm';
import AdminDashboard from './components/AdminDashboard';
import DataTerms from './components/DataTerms';
import WhyWhoWhat from './components/WhyWhoWhat';
import FAQ from './components/FAQ';
import JobDetailModal from './components/JobDetailModal';
import { JobFilterState, JobPosting } from './types';
import { getJobs, getJobById, adminLogin, hasAdminSession } from './services/jobService';
import { parseSearchQuery } from './services/geminiService';
import { normalizeParsedSearchFilters } from './utils/normalizeSearchFilters';
import { Search, Loader2, Lock, ChevronDown, Hexagon, X, Filter, Globe, Users } from 'lucide-react';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'browse' | 'submit' | 'admin' | 'terms' | 'about' | 'faq'>('browse');
  
  // Feed State
  const [feedType, setFeedType] = useState<'direct' | 'aggregated'>('direct');
  
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Mobile UX State
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Modal State
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);

  // AI Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessingAI, setIsProcessingAI] = useState(false);

  const [filters, setFilters] = useState<JobFilterState>({
    keyword: '',
    remotePolicies: [],
    seniorityLevels: [], 
    employmentTypes: [],
    locations: [],
    dateRange: 'all'
  });

  // URL Sync
  useEffect(() => {
    setIsAdmin(hasAdminSession());

    // 1. Parse URL params on mount
    const params = new URLSearchParams(window.location.search);
    const jobId = params.get('jobId');
    const keyword = params.get('keyword');
    const feed = params.get('feed');

    if (keyword) {
        setSearchQuery(keyword);
        setFilters(prev => ({ ...prev, keyword }));
    }

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
  }, []);

  // Update URL when filters/job/feed changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.keyword) params.set('keyword', filters.keyword);
    if (selectedJob) params.set('jobId', selectedJob.id);
    if (feedType === 'aggregated') params.set('feed', 'aggregated');
    
    // Use replaceState for filters, pushState for modal to support back button
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

  const activeFilterCount = 
    filters.remotePolicies.length + 
    filters.employmentTypes.length + 
    filters.seniorityLevels.length;

  useEffect(() => {
    if (!showAdminLogin) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowAdminLogin(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showAdminLogin]);

  useEffect(() => {
    if (currentView === 'browse') {
      const controller = new AbortController();

      const fetchJobs = async () => {
        setLoading(true);
        setLoadError(null);
        try {
          const data = await getJobs(filters, feedType, controller.signal);
          // Ranking Logic: Tier 1 (Direct/Verified) -> Date
          const rankedData = [...data].sort((a, b) => {
             // For Aggregated feed, just sort by date
             if (feedType === 'aggregated') {
                 return new Date(b.postedDate).getTime() - new Date(a.postedDate).getTime();
             }
             // For Direct feed
             if (a.sourceType === 'Direct' && b.sourceType !== 'Direct') return -1;
             if (a.sourceType !== 'Direct' && b.sourceType === 'Direct') return 1;
             return new Date(b.postedDate).getTime() - new Date(a.postedDate).getTime();
          });
          setJobs(rankedData);
        } catch (error) {
          if (controller.signal.aborted) return;
          console.error(error);
          setLoadError('Unable to load roles right now. Please try again.');
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
    setSelectedJob(job);
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    setFilters(prev => ({ ...prev, keyword: val }));
  };

  const clearSearch = () => {
      setSearchQuery('');
      setFilters(prev => ({ ...prev, keyword: '' }));
  };

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery.trim().length > 2) {
        setIsProcessingAI(true);
        try {
            const parsedFilters = await parseSearchQuery(searchQuery);
            const normalized = normalizeParsedSearchFilters(parsedFilters as any);
            if (normalized) {
                setFilters(prev => ({
                    ...prev,
                    keyword: normalized.keyword || '',
                    remotePolicies: normalized.remotePolicies,
                    employmentTypes: normalized.employmentTypes,
                    seniorityLevels: normalized.seniorityLevels,
                    dateRange: normalized.dateRange || 'all'
                }));
            }
        } finally {
            setIsProcessingAI(false);
        }
    }
  };

  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
        const success = await adminLogin(adminUsername, adminPassword);
        if (success) {
            setIsAdmin(true);
            setShowAdminLogin(false);
            setCurrentView('admin');
            setAdminUsername('admin');
            setAdminPassword('');
        } else {
            setLoginError('Invalid credentials');
        }
    } catch {
      setLoginError('Login failed');
    }
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
      return <SubmitJobForm onSuccess={() => setCurrentView('browse')} onOpenTerms={() => setCurrentView('terms')} />;
    }
    
    // Browse View
    return (
      <div className="flex flex-col md:flex-row gap-6 md:gap-10 items-start">
        {/* Sidebar Filters */}
        <aside className="w-full md:w-64 shrink-0">
            {/* Mobile Filter Toggle */}
            <button 
                type="button"
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                className="md:hidden w-full mb-4 flex items-center justify-between bg-white border border-gray-200 px-4 py-3 rounded-xl shadow-sm text-sm font-bold text-gray-900 transition-colors hover:bg-gray-50"
                aria-expanded={showMobileFilters}
                aria-controls="browse-filters-panel"
            >
                <div className="flex items-center gap-2">
                    <Filter size={16} className="text-gray-500"/>
                    <span>Filters</span>
                    {activeFilterCount > 0 && (
                        <span className="bg-blue-600 text-white text-[10px] h-5 w-5 flex items-center justify-center rounded-full">
                            {activeFilterCount}
                        </span>
                    )}
                </div>
                <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 ${showMobileFilters ? 'rotate-180' : ''}`} />
            </button>

            {/* Filter Content */}
            <div id="browse-filters-panel" className={`${showMobileFilters ? 'block' : 'hidden'} md:block animate-slide-up md:animate-none`}>
                <div className="mb-8">
                    <JobFilters filters={filters} setFilters={setFilters} />
                </div>
                
                <div className="pt-8 border-t border-gray-200">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Admin & Info</h3>
                    <div className="space-y-2 flex flex-col items-start">
                        <button type="button" onClick={() => setCurrentView('terms')} className="text-xs font-medium text-gray-500 hover:text-blue-600 transition-colors text-left">
                            Data, Terms & Common Sense
                        </button>
                        <button type="button" onClick={() => setCurrentView('about')} className="text-xs font-medium text-gray-500 hover:text-blue-600 transition-colors text-left">
                            Why, Who, & What
                        </button>
                        <button type="button" onClick={() => setCurrentView('faq')} className="text-xs font-medium text-gray-500 hover:text-blue-600 transition-colors text-left">
                            FAQ
                        </button>
                        <button type="button" onClick={() => setShowAdminLogin(true)} className="text-xs font-bold text-gray-400 hover:text-gray-600 flex items-center gap-1 mt-2">
                            <Lock size={12} /> Admin Login
                        </button>
                    </div>
                </div>
            </div>
        </aside>

        <div className="flex-1 w-full">
            {/* Minimalist Search */}
            <div className="relative mb-6">
               <label htmlFor="job-search" className="sr-only">Search jobs</label>
               <div className="relative flex items-center">
                  <Search className="absolute left-4 text-gray-400" size={20} />
                  <input
                    id="job-search"
                    type="text"
                    placeholder={feedType === 'aggregated' ? "Search Canadian Fintech (e.g. Wealthsimple)..." : "Describe your ideal role (e.g. 'Remote React jobs')..."}
                    className="w-full pl-12 pr-12 py-4 bg-white border border-gray-200 rounded-xl text-lg text-gray-900 placeholder:text-gray-400 focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all shadow-sm"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    onKeyDown={handleKeyDown}
                    aria-describedby="job-search-help"
                  />
                  <span id="job-search-help" className="sr-only">Type keywords to filter. Press Enter to let AI parse your search.</span>
                  {searchQuery && !isProcessingAI && (
                      <button type="button" onClick={clearSearch} className="absolute right-4 text-gray-400 hover:text-gray-600" aria-label="Clear search text">
                          <X size={20} />
                      </button>
                  )}
                  {isProcessingAI && (
                      <div className="absolute right-4">
                          <Loader2 className="animate-spin text-blue-600" size={20} />
                      </div>
                  )}
               </div>
            </div>

            {/* Feed Toggle */}
            <div className="flex items-center gap-2 mb-6">
                <button
                    type="button"
                    onClick={() => setFeedType('direct')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition-all border ${
                        feedType === 'direct'
                        ? 'bg-gray-900 text-white border-gray-900 shadow-md transform scale-105'
                        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:text-gray-700'
                    }`}
                    aria-pressed={feedType === 'direct'}
                >
                    <Users size={16} />
                    Community Board
                </button>
                <button
                    type="button"
                    onClick={() => setFeedType('aggregated')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition-all border ${
                        feedType === 'aggregated'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105'
                        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:text-gray-700'
                    }`}
                    aria-pressed={feedType === 'aggregated'}
                >
                    <Globe size={16} />
                    Web Pulse 🇨🇦
                </button>
            </div>

            {/* Feed Info / Disclaimer */}
            {feedType === 'aggregated' && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800 flex items-start gap-3 animate-fade-in">
                    <Globe size={18} className="mt-0.5 shrink-0" />
                    <div>
                        <p className="font-bold">Automated Canadian Fintech Feed</p>
                        <p className="opacity-80">This feed pulls public listings from major Canadian banks and fintechs posted in the last 14 days. These are not manually verified by the Commons.</p>
                    </div>
                </div>
            )}

            {/* Feed */}
            {loading ? (
                <div className="py-20 text-center text-gray-400 flex flex-col items-center gap-3" role="status" aria-live="polite">
                     <Loader2 className="animate-spin text-gray-300" size={32} />
                     <span>Scanning {feedType === 'aggregated' ? 'external sources' : 'database'}...</span>
                </div>
            ) : loadError ? (
                <div className="py-20 text-center rounded-xl border border-red-200 bg-red-50 text-red-700" role="alert">
                    <p className="font-semibold mb-3">{loadError}</p>
                    <button
                      type="button"
                      onClick={() => setReloadNonce((prev) => prev + 1)}
                      className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
                    >
                      Retry
                    </button>
                </div>
            ) : (
                <>
                    {jobs.length === 0 ? (
                        <div className="py-20 text-center text-gray-400 border border-dashed border-gray-300 rounded-xl bg-gray-50/50">
                            No {feedType === 'aggregated' ? 'Canadian' : ''} opportunities found matching your filters.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-slide-up" aria-live="polite" aria-busy={loading}>
                            {jobs.map(job => (
                                <JobCard 
                                    key={job.id} 
                                    job={job} 
                                    onSelect={handleSelectJob}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen font-sans bg-gray-50 text-gray-900 flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[90] focus:bg-white focus:text-gray-900 focus:px-3 focus:py-2 focus:rounded-md focus:shadow"
      >
        Skip to main content
      </a>
      
      <Header currentView={currentView === 'submit' ? 'submit' : 'browse'} setCurrentView={setCurrentView} />

      {/* Modal - Render at root */}
      {selectedJob && (
          <JobDetailModal 
            job={selectedJob} 
            onClose={() => {
                setSelectedJob(null);
                // Clean up URL parameter on close
                const params = new URLSearchParams(window.location.search);
                params.delete('jobId');
                const url = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
                window.history.pushState({}, '', url);
                document.title = 'Commons Jobs | Fintech Commons';
            }} 
          />
      )}

      {/* Admin Login Modal */}
      {showAdminLogin && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4" onClick={() => setShowAdminLogin(false)}>
            <div
                className="bg-white rounded-lg shadow-xl p-8 w-full max-w-sm"
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-login-title"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-6">
                    <h3 id="admin-login-title" className="text-lg font-bold text-gray-900">Admin Access</h3>
                    <button type="button" onClick={() => setShowAdminLogin(false)} className="text-gray-400 hover:text-gray-600" aria-label="Close admin login dialog">
                        <ChevronDown className="rotate-180" size={20} />
                    </button>
                </div>
                <form onSubmit={handleAdminLoginSubmit}>
                    <label htmlFor="admin-username" className="sr-only">Username</label>
                    <input 
                        id="admin-username"
                        type="text" 
                        placeholder="Username" 
                        className="w-full p-3 bg-white border border-gray-300 rounded-lg mb-3 focus:ring-1 focus:ring-blue-600 outline-none"
                        value={adminUsername}
                        onChange={e => setAdminUsername(e.target.value)}
                        autoComplete="username"
                        required
                    />
                    <label htmlFor="admin-password" className="sr-only">Password</label>
                    <input 
                        id="admin-password"
                        type="password" 
                        placeholder="Password" 
                        className="w-full p-3 bg-white border border-gray-300 rounded-lg mb-4 focus:ring-1 focus:ring-blue-600 outline-none"
                        value={adminPassword}
                        onChange={e => setAdminPassword(e.target.value)}
                        autoFocus
                        autoComplete="current-password"
                        required
                    />
                    {loginError && <p className="text-red-600 text-xs mb-4" role="alert">{loginError}</p>}
                    <button type="submit" className="w-full bg-gray-900 text-white py-3 rounded-lg font-bold text-sm hover:bg-gray-800">
                        Login
                    </button>
                </form>
            </div>
        </div>
      )}

      <main id="main-content" className="flex-grow max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {renderContent()}
      </main>

      <footer className="border-t border-gray-200 py-12 mt-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 text-center space-y-6">
          <div className="flex items-center justify-center gap-2 text-gray-900 font-bold text-lg tracking-tight hover:text-gray-600 transition-all duration-500">
             <Hexagon size={20} strokeWidth={2.5} /> Commons Jobs
          </div>
          <p className="text-gray-500 text-sm">Curated opportunities for the next generation of finance.</p>
          
          <div className="flex flex-wrap justify-center gap-6 text-sm font-medium text-gray-500">
             <button type="button" onClick={() => setCurrentView('terms')} className="hover:text-blue-600 transition-colors">
                Data, Terms & Common Sense
            </button>
            <button type="button" onClick={() => setCurrentView('about')} className="hover:text-blue-600 transition-colors">
                Why, Who, & What
            </button>
            <button type="button" onClick={() => setCurrentView('faq')} className="hover:text-blue-600 transition-colors">
                FAQ
            </button>
          </div>

          <div className="pt-4 max-w-xl mx-auto">
             <p className="text-xs text-gray-400">
                Email <a href="mailto:admin@fintechcommons.io" className="text-blue-600 hover:underline">admin@fintechcommons.io</a> for edits or takedowns.
             </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
