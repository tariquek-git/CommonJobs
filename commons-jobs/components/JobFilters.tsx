
import React from 'react';
import { JobSearchFacets, RemotePolicy, EmploymentType, JobFilterState, SeniorityLevel } from '../types';
import { X } from 'lucide-react';

interface JobFiltersProps {
  filters: JobFilterState;
  facets: JobSearchFacets;
  setFilters: React.Dispatch<React.SetStateAction<JobFilterState>>;
}

interface FilterGroupProps<T extends string> {
    label: string;
    options: T[];
    selected: T[];
    counts: Record<string, number>;
    filterKey: keyof JobFilterState;
    onToggle: (key: keyof JobFilterState, value: T) => void;
}

const FilterGroup = <T extends string>({ 
    label, 
    options, 
    selected, 
    counts,
    filterKey,
    onToggle
  }: FilterGroupProps<T>) => (
    <div className="space-y-2">
      <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => {
          const isActive = selected.includes(opt);
          const count = counts[opt] || 0;
          const isDisabled = !isActive && count === 0;
          return (
            <button
              type="button"
              key={opt}
              onClick={() => onToggle(filterKey, opt)}
              disabled={isDisabled}
              className={`
                px-3 py-1.5 rounded-full text-xs font-bold transition-all border
                ${isActive 
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                  : `bg-white border-gray-200 ${isDisabled ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`
                }
              `}
              aria-pressed={isActive}
            >
              {opt} ({count})
            </button>
          );
        })}
      </div>
    </div>
);

const JobFilters: React.FC<JobFiltersProps> = ({ filters, facets, setFilters }) => {
  const toggleFilter = <T extends string>(
    key: keyof JobFilterState,
    value: T
  ) => {
    setFilters(prev => {
      const current = prev[key] as T[];
      const exists = current.includes(value);
      return {
        ...prev,
        [key]: exists ? current.filter(item => item !== value) : [...current, value],
        page: 1
      };
    });
  };

  const clearFilters = () => {
    setFilters(prev => ({
      ...prev,
      remotePolicies: [],
      employmentTypes: [],
      seniorityLevels: [],
      dateRange: 'all',
      page: 1
    }));
  };

  const hasFilters = 
    filters.remotePolicies.length > 0 || 
    filters.employmentTypes.length > 0 || 
    filters.seniorityLevels.length > 0;

  return (
    <div className="space-y-6">
        <FilterGroup 
            label="Employment Type"
            options={Object.values(EmploymentType)}
            selected={filters.employmentTypes}
            counts={facets.employmentTypes}
            filterKey="employmentTypes"
            onToggle={toggleFilter}
        />
        <FilterGroup 
            label="Remote Policy"
            options={Object.values(RemotePolicy)}
            selected={filters.remotePolicies}
            counts={facets.remotePolicies}
            filterKey="remotePolicies"
            onToggle={toggleFilter}
        />
        <FilterGroup 
            label="Seniority"
            options={Object.values(SeniorityLevel)}
            selected={filters.seniorityLevels}
            counts={facets.seniorityLevels}
            filterKey="seniorityLevels"
            onToggle={toggleFilter}
        />
        
        {hasFilters && (
            <button 
                type="button"
                onClick={clearFilters}
                className="text-xs font-bold text-gray-600 hover:text-red-700 flex items-center gap-1"
            >
                <X size={12} /> Clear all filters
            </button>
        )}
    </div>
  );
};

export default JobFilters;
