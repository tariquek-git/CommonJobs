
import React, { useEffect, useMemo, useState } from 'react';
import { JobPosting, JobStatus } from '../types';
import { getAdminJobs, getAdminRuntime, type AdminRuntimeInfo, updateJobStatus } from '../services/jobService';
import { Plus, RefreshCw, Pencil, ArrowLeft, Archive, ExternalLink, Download } from 'lucide-react';
import SubmitJobForm from './SubmitJobForm';

const COMPANY_CAP = 5;

const AdminDashboard: React.FC = () => {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runtime, setRuntime] = useState<AdminRuntimeInfo | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'rejected' | 'archived'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'Direct' | 'Aggregated'>('all');
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);
  const [editingJob, setEditingJob] = useState<JobPosting | null>(null);
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [moderationNotes, setModerationNotes] = useState<Record<string, string>>({});
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : null;

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminJobs();
      setJobs(data);
    } catch {
      setError('Failed to load admin jobs. Please log in again.');
    }
    setLoading(false);
  };

  useEffect(() => {
    void fetchJobs();
  }, []);

  useEffect(() => {
    const loadRuntime = async () => {
      setRuntimeError(null);
      try {
        const info = await getAdminRuntime();
        setRuntime(info);
      } catch {
        setRuntime(null);
        setRuntimeError('System info unavailable.');
      }
    };
    void loadRuntime();
  }, []);

  const recordModerationNote = (id: string, status: JobStatus, roleTitle: string) => {
    if (status !== 'rejected' && status !== 'archived') return;
    const note = window.prompt(`Optional moderation note for ${roleTitle}:`, '')?.trim() || '';
    if (!note) return;
    setModerationNotes((prev) => ({ ...prev, [id]: note }));
    console.info('[moderation-note]', { id, status, note });
  };

  const handleStatusUpdate = async (id: string, status: JobStatus) => {
    const previous = jobs;
    const target = jobs.find((job) => job.id === id);
    if (target) {
      recordModerationNote(id, status, target.roleTitle);
    }

    setJobs((prev) => prev.map((job) => (job.id === id ? { ...job, status } : job)));
    try {
      await updateJobStatus(id, status);
    } catch {
      setJobs(previous);
      setError('Status update failed. Please retry.');
    }
  };

  const handleArchive = async (id: string, roleTitle: string) => {
    if (!window.confirm('Archive this job? It will not be deleted from DB.')) return;
    recordModerationNote(id, 'archived', roleTitle);
    try {
      await updateJobStatus(id, 'archived');
      setJobs((prev) => prev.map((job) => (job.id === id ? { ...job, status: 'archived' } : job)));
    } catch {
      setError('Archive failed. Please retry.');
    }
  };

  const duplicateCompanySet = useMemo(() => {
    const counts = new Map<string, number>();
    for (const job of jobs) {
      counts.set(job.companyName, (counts.get(job.companyName) || 0) + 1);
    }
    return new Set(Array.from(counts.entries()).filter(([, count]) => count > 1).map(([company]) => company));
  }, [jobs]);

  const companyCapViolations = useMemo(() => {
    const counts = new Map<string, number>();
    for (const job of jobs) {
      if (job.sourceType !== 'Aggregated' || job.status !== 'active') continue;
      counts.set(job.companyName, (counts.get(job.companyName) || 0) + 1);
    }
    return Array.from(counts.entries())
      .filter(([, count]) => count > COMPANY_CAP)
      .map(([company, count]) => ({ company, count }))
      .sort((a, b) => b.count - a.count);
  }, [jobs]);

  const filteredJobs = useMemo(
    () =>
      jobs.filter((job) => {
        const statusMatch = filter === 'all' ? true : job.status === filter;
        const sourceMatch = sourceFilter === 'all' ? true : job.sourceType === sourceFilter;
        const duplicateMatch = duplicatesOnly ? duplicateCompanySet.has(job.companyName) : true;
        return statusMatch && sourceMatch && duplicateMatch;
      }),
    [duplicateCompanySet, duplicatesOnly, filter, jobs, sourceFilter]
  );

  const selectedVisibleIds = useMemo(
    () => filteredJobs.filter((job) => selectedIds.has(job.id)).map((job) => job.id),
    [filteredJobs, selectedIds]
  );

  const storageProbeFailed = runtime?.storageProbe?.ok === false;

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allVisibleSelected = filteredJobs.every((job) => next.has(job.id));
      if (allVisibleSelected) {
        filteredJobs.forEach((job) => next.delete(job.id));
      } else {
        filteredJobs.forEach((job) => next.add(job.id));
      }
      return next;
    });
  };

  const runBulkUpdate = async (nextStatus: JobStatus) => {
    if (selectedVisibleIds.length === 0) return;
    setBulkUpdating(true);
    try {
      await Promise.all(selectedVisibleIds.map((id) => updateJobStatus(id, nextStatus)));
      setJobs((prev) => prev.map((job) => (selectedVisibleIds.includes(job.id) ? { ...job, status: nextStatus } : job)));
      setSelectedIds(new Set());
    } catch {
      setError('Bulk action failed. Please retry.');
    } finally {
      setBulkUpdating(false);
    }
  };

  const downloadRebalanceSuggestion = () => {
    const activeAggregated = jobs
      .filter((job) => job.sourceType === 'Aggregated' && job.status === 'active')
      .sort((a, b) => new Date(b.postedDate).getTime() - new Date(a.postedDate).getTime());

    const grouped = new Map<string, JobPosting[]>();
    for (const job of activeAggregated) {
      if (!grouped.has(job.companyName)) grouped.set(job.companyName, []);
      grouped.get(job.companyName)!.push(job);
    }

    const suggestions = Array.from(grouped.entries())
      .map(([company, companyJobs]) => ({
        company,
        activeCount: companyJobs.length,
        keep: companyJobs.slice(0, COMPANY_CAP).map((job) => ({ id: job.id, roleTitle: job.roleTitle })),
        archiveSuggestion: companyJobs.slice(COMPANY_CAP).map((job) => ({ id: job.id, roleTitle: job.roleTitle }))
      }))
      .filter((entry) => entry.activeCount > COMPANY_CAP);

    const payload = {
      generatedAt: new Date().toISOString(),
      companyCap: COMPANY_CAP,
      suggestions
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `rebalance-suggestion-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (editingJob || isCreatingJob) {
    return (
      <div className={editingJob ? 'grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6' : 'max-w-3xl mx-auto'}>
        <div>
          <button
            type="button"
            onClick={() => {
              setEditingJob(null);
              setIsCreatingJob(false);
            }}
            className="mb-6 flex items-center gap-2 text-gray-500 hover:text-gray-900 font-medium"
          >
            <ArrowLeft size={18} /> Back
          </button>
          <SubmitJobForm
            key={editingJob ? editingJob.id : 'admin-new-job'}
            initialData={editingJob || undefined}
            isAdminMode
            defaultSourceType="Aggregated"
            onSuccess={() => {
              setEditingJob(null);
              setIsCreatingJob(false);
              void fetchJobs();
            }}
            onOpenTerms={() => {}}
          />
        </div>

        {editingJob && (
          <aside className="rounded-xl border border-gray-200 bg-white p-5 h-fit xl:sticky xl:top-24 space-y-4">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Review Preview</h2>
            <div className="text-xs text-gray-500">
              <div className="font-bold text-gray-700 mb-1">Original Link</div>
              <a
                href={editingJob.externalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:underline break-all"
              >
                {editingJob.externalLink} <ExternalLink size={12} />
              </a>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs text-gray-500 mb-2">Parsed Summary</div>
              <p className="text-sm text-gray-700 leading-relaxed">
                {editingJob.intelligenceSummary || 'No summary generated yet.'}
              </p>
            </div>
            <div className="rounded-lg border border-[#cdece8] bg-[#f4fbfa] p-4">
              <div className="text-xs text-[#0b5f58] font-bold mb-2 uppercase">Public Card Preview</div>
              <div className="font-bold text-[#0B132B]">{editingJob.roleTitle}</div>
              <div className="text-sm text-gray-600 mb-2">{editingJob.companyName}</div>
              <div className="text-xs text-gray-500">
                {(editingJob.locationCity || 'City TBD')} · {editingJob.locationCountry || 'Country TBD'} ·{' '}
                {editingJob.remotePolicy || 'Remote policy TBD'}
              </div>
            </div>
          </aside>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Intelligence Console</h1>
          <div className="mt-1 text-xs text-gray-500">
            {runtime ? (
              <>
                Storage: <span className="font-semibold text-gray-700">{runtime.provider}</span>
                {runtime.provider === 'supabase' && (
                  <>
                    {' '}
                    ({runtime.tables.jobs}, {runtime.tables.clicks})
                  </>
                )}
                {' '}· AI: <span className="font-semibold text-gray-700">{runtime.gemini.enabled ? runtime.gemini.model : 'disabled'}</span>
                {' '}· Storage Probe:{' '}
                <span className={`font-semibold ${runtime.storageProbe?.ok === false ? 'text-red-700' : 'text-gray-700'}`}>
                  {runtime.storageProbe?.ok === false ? 'failed' : `${runtime.storageProbe?.totalJobs ?? 0} jobs`}
                </span>
              </>
            ) : runtimeError ? (
              runtimeError
            ) : (
              'Loading system info...'
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCreatingJob(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} /> Add Job
          </button>
          <div className="flex bg-white rounded-lg border border-gray-200 p-1">
            {(['all', 'pending', 'active', 'rejected', 'archived'] as const).map((f) => (
              <button
                type="button"
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs font-bold rounded capitalize ${filter === f ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {storageProbeFailed && runtime && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
          <div className="font-bold mb-1">Storage probe failed</div>
          <p className="mb-2">{runtime.storageProbe?.error || 'Unknown storage error.'}</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Verify `SUPABASE_SERVICE_ROLE_KEY` is current and valid.</li>
            <li>Verify table names match env: `{runtime.tables.jobs}` and `{runtime.tables.clicks}`.</li>
            <li>Verify `CLIENT_ORIGIN` includes the active origin `{currentOrigin || 'unknown'}`.</li>
          </ul>
        </div>
      )}

      {companyCapViolations.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-bold mb-2">Aggregated company cap warning (max {COMPANY_CAP})</div>
          <div className="text-xs mb-3">
            {companyCapViolations.map((entry) => `${entry.company}: ${entry.count}`).join(' · ')}
          </div>
          <button
            type="button"
            onClick={downloadRebalanceSuggestion}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100"
          >
            <Download size={14} /> Download Rebalance Suggestion
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(['all', 'Direct', 'Aggregated'] as const).map((source) => (
          <button
            type="button"
            key={source}
            onClick={() => setSourceFilter(source)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
              sourceFilter === source ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            {source === 'all' ? 'All Sources' : source}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setFilter('pending');
            setSourceFilter('all');
            setDuplicatesOnly(false);
          }}
          className="px-3 py-1.5 rounded-full text-xs font-bold border bg-white text-gray-700 border-gray-200 hover:border-gray-300"
        >
          Pending only
        </button>
        <button
          type="button"
          onClick={() => {
            setSourceFilter('Aggregated');
            setDuplicatesOnly(false);
          }}
          className="px-3 py-1.5 rounded-full text-xs font-bold border bg-white text-gray-700 border-gray-200 hover:border-gray-300"
        >
          Aggregated only
        </button>
        <button
          type="button"
          onClick={() => setDuplicatesOnly((prev) => !prev)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
            duplicatesOnly ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
          }`}
        >
          Duplicates by company
        </button>
      </div>

      {selectedVisibleIds.length > 0 && (
        <div className="mb-3 rounded-lg border border-gray-200 bg-white px-4 py-3 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            {selectedVisibleIds.length} selected
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={bulkUpdating}
              onClick={() => void runBulkUpdate('active')}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-60"
            >
              Bulk Approve
            </button>
            <button
              type="button"
              disabled={bulkUpdating}
              onClick={() => void runBulkUpdate('archived')}
              className="rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-black disabled:opacity-60"
            >
              Bulk Archive
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {error ? (
          <div className="p-8 text-center text-red-600 text-sm font-medium">{error}</div>
        ) : loading ? (
          <div className="p-8 text-center text-gray-500 flex justify-center"><RefreshCw className="animate-spin" /></div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all visible jobs"
                    checked={filteredJobs.length > 0 && filteredJobs.every((job) => selectedIds.has(job.id))}
                    onChange={toggleSelectAllVisible}
                  />
                </th>
                <th className="px-6 py-3 font-bold text-gray-700">Role</th>
                <th className="px-6 py-3 font-bold text-gray-700">Source</th>
                <th className="px-6 py-3 font-bold text-gray-700">Intelligence</th>
                <th className="px-6 py-3 font-bold text-gray-700">Status</th>
                <th className="px-6 py-3 font-bold text-gray-700 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredJobs.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(job.id)}
                      onChange={() => toggleSelection(job.id)}
                      aria-label={`Select ${job.roleTitle}`}
                    />
                  </td>
                  <td className="px-6 py-3 max-w-xs">
                    <div className="font-bold text-gray-900">{job.roleTitle}</div>
                    <div className="text-gray-500 text-xs">{job.companyName}</div>
                    {moderationNotes[job.id] && <div className="text-[11px] text-amber-700 mt-1">Note: {moderationNotes[job.id]}</div>}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                        job.sourceType === 'Direct' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-600 border-gray-200'
                      }`}
                    >
                      {job.sourceType}
                    </span>
                  </td>
                  <td className="px-6 py-3 max-w-xs text-xs text-gray-500 truncate">{job.intelligenceSummary || '-'}</td>
                  <td className="px-6 py-3">
                    <select
                      value={job.status}
                      onChange={(e) => void handleStatusUpdate(job.id, e.target.value as JobStatus)}
                      className="bg-transparent text-xs font-bold border-none outline-none cursor-pointer"
                    >
                      <option value="pending">Pending</option>
                      <option value="active">Active</option>
                      <option value="rejected">Rejected</option>
                      <option value="archived">Archived</option>
                    </select>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setEditingJob(job)}
                      className="text-gray-400 hover:text-blue-600 mr-3"
                      aria-label={`Edit ${job.roleTitle}`}
                    >
                      <Pencil size={16} />
                    </button>
                    {job.status !== 'archived' && (
                      <button
                        type="button"
                        onClick={() => void handleArchive(job.id, job.roleTitle)}
                        className="text-gray-400 hover:text-red-600"
                        aria-label={`Archive ${job.roleTitle}`}
                      >
                        <Archive size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
