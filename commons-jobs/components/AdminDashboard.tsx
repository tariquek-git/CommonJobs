
import React, { useEffect, useState } from 'react';
import { JobPosting, JobStatus } from '../types';
import { getAdminJobs, updateJobStatus } from '../services/jobService';
import { Plus, RefreshCw, Pencil, ArrowLeft, Archive } from 'lucide-react';
import SubmitJobForm from './SubmitJobForm';

const AdminDashboard: React.FC = () => {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'rejected' | 'archived'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'Direct' | 'Aggregated'>('all');
  const [editingJob, setEditingJob] = useState<JobPosting | null>(null);
  const [isCreatingJob, setIsCreatingJob] = useState(false);

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
    fetchJobs();
  }, []);

  const handleStatusUpdate = async (id: string, status: JobStatus) => {
    setJobs(prev => prev.map(job => job.id === id ? { ...job, status } : job));
    await updateJobStatus(id, status);
  };

  const handleArchive = async (id: string) => {
    if (window.confirm('Archive this job? It will not be deleted from DB.')) {
        await updateJobStatus(id, 'archived');
        fetchJobs();
    }
  };

  if (editingJob || isCreatingJob) {
      return (
          <div className="max-w-3xl mx-auto">
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
                  initialData={editingJob} 
                  isAdminMode
                  defaultSourceType="Aggregated"
                  onSuccess={() => {
                      setEditingJob(null);
                      setIsCreatingJob(false);
                      fetchJobs();
                  }}
                  onOpenTerms={() => {}} 
              />
          </div>
      );
  }

  const filteredJobs = jobs.filter(job => {
    const statusMatch = filter === 'all' ? true : job.status === filter;
    const sourceMatch = sourceFilter === 'all' ? true : job.sourceType === sourceFilter;
    return statusMatch && sourceMatch;
  });

  return (
    <div className="max-w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
           <h1 className="text-xl font-bold text-gray-900">Intelligence Console</h1>
           <div className="flex items-center gap-2">
             <button
               type="button"
               onClick={() => setIsCreatingJob(true)}
               className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors"
             >
               <Plus size={14} /> Add Job
             </button>
             <div className="flex bg-white rounded-lg border border-gray-200 p-1">
                 {(['all', 'pending', 'active', 'rejected', 'archived'] as const).map(f => (
                   <button
                     type="button"
                     key={f}
                     onClick={() => setFilter(f)}
                     className={`px-3 py-1 text-xs font-bold rounded capitalize ${
                       filter === f ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'
                     }`}
                   >
                     {f}
                   </button>
                 ))}
             </div>
           </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
          {(['all', 'Direct', 'Aggregated'] as const).map(source => (
            <button
              type="button"
              key={source}
              onClick={() => setSourceFilter(source)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                sourceFilter === source
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {source === 'all' ? 'All Sources' : source}
            </button>
          ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {error ? (
           <div className="p-8 text-center text-red-600 text-sm font-medium">{error}</div>
        ) : loading ? (
           <div className="p-8 text-center text-gray-500 flex justify-center"><RefreshCw className="animate-spin" /></div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 font-bold text-gray-700">Role</th>
                <th className="px-6 py-3 font-bold text-gray-700">Source</th>
                <th className="px-6 py-3 font-bold text-gray-700">Intelligence</th>
                <th className="px-6 py-3 font-bold text-gray-700">Status</th>
                <th className="px-6 py-3 font-bold text-gray-700 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredJobs.map(job => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 max-w-xs">
                    <div className="font-bold text-gray-900">{job.roleTitle}</div>
                    <div className="text-gray-500 text-xs">{job.companyName}</div>
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                        job.sourceType === 'Direct' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-600 border-gray-200'
                    }`}>
                        {job.sourceType}
                    </span>
                  </td>
                  <td className="px-6 py-3 max-w-xs text-xs text-gray-500 truncate">
                      {job.intelligenceSummary || '-'}
                  </td>
                  <td className="px-6 py-3">
                      <select
                        value={job.status}
                        onChange={(e) => handleStatusUpdate(job.id, e.target.value as JobStatus)}
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
                      <Pencil size={16}/>
                    </button>
                    {job.status !== 'archived' && (
                      <button
                        type="button"
                        onClick={() => handleArchive(job.id)}
                        className="text-gray-400 hover:text-red-600"
                        aria-label={`Archive ${job.roleTitle}`}
                      >
                        <Archive size={16}/>
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
