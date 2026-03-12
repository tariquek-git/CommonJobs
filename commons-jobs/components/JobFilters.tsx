
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
    <div className="space-y-2.5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--cj-text-muted)]">{label}</div>
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
                inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-premium focus-visible:focus-ring
                ${isActive 
                  ? 'border-[var(--cj-accent)] bg-[#e9f8f6] text-[var(--cj-accent-strong)] shadow-[0_2px_8px_rgba(42,184,170,0.16)]' 
                  : `bg-white ${isDisabled ? 'cursor-not-allowed border-[var(--cj-stroke-soft)] text-[#9aa6b7]' : 'border-[var(--cj-stroke-soft)] text-[var(--cj-text-secondary)] hover:border-[var(--cj-stroke-strong)] hover:bg-[#f7fafc]'}`
                }
              `}
              aria-pressed={isActive}
            >
              <span>{opt}</span>
              <span className={`rounded-full px-1.5 py-[1px] text-[10px] font-bold ${isActive ? 'bg-white/85 text-[var(--cj-accent-strong)]' : 'bg-[#eef3f6] text-[var(--cj-text-muted)]'}`}>
                {count}
              </span>
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
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--cj-text-secondary)] transition-premium hover:text-[#9f3a3a] focus-visible:focus-ring"
            >
                <X size={12} /> Clear all filters
            </button>
        )}
    </div>
  );
};

export default JobFilters;
