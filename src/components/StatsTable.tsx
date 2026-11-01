import { useState } from 'react';
import type { SortingState } from '@tanstack/react-table';
import { useFantasyData } from '../hooks/useFantasyData';
import { DEFAULT_SORTING } from '../utils/view';
import { ResultsTable } from './ResultsTable';

export function StatsTable() {
  const { data, loading, error } = useFantasyData();
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-gray-500">
          <svg
            className="animate-spin h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Loading data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-red-600 text-center">
          <p className="font-medium">Error loading data</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">No data found for the selected filters.</p>
      </div>
    );
  }

  return <ResultsTable data={data} sorting={sorting} onSortingChange={setSorting} />;
}
