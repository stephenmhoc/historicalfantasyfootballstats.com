import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
} from '@tanstack/react-table';
import { useFantasyData } from '../hooks/useFantasyData';
import { useFantasyStore } from '../stores/fantasyStore';
import { getColumnsForPosition } from '../utils/columns';

const TEXT_COLUMNS = new Set(['rank', 'player', 'team', 'year', 'week', 'opponent']);

const ARIA_SORT = { asc: 'ascending', desc: 'descending' } as const;

export function StatsTable() {
  const { data, loading, error } = useFantasyData();
  const positionFilter = useFantasyStore((state) => state.positionFilter);
  const weekFilter = useFantasyStore((state) => state.weekFilter);
  const showWeek = typeof weekFilter === 'number';

  const [sorting, setSorting] = useState<SortingState>([
    { id: 'fantasyPoints', desc: true },
  ]);

  const columns = useMemo(
    () => getColumnsForPosition(positionFilter, showWeek),
    [positionFilter, showWeek]
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

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

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const isPlayerColumn = header.column.id === 'player';
                const isTextColumn = TEXT_COLUMNS.has(header.column.id);
                const sorted = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    aria-sort={sorted ? ARIA_SORT[sorted] : 'none'}
                    className={`p-0 hover:bg-gray-100
                               ${isPlayerColumn ? 'sticky left-0 z-10 bg-gray-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}`}
                    style={{ width: header.column.getSize() }}
                  >
                    <button
                      type="button"
                      onClick={header.column.getToggleSortingHandler()}
                      className={`w-full px-3 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider
                                 cursor-pointer select-none whitespace-nowrap flex items-center gap-1
                                 ${isTextColumn ? 'text-left' : 'text-right justify-end'}`}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {sorted === 'asc' && ' ↑'}
                      {sorted === 'desc' && ' ↓'}
                    </button>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {table.getRowModel().rows.map((row, index) => (
            <tr
              key={row.id}
              className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
            >
              {row.getVisibleCells().map((cell) => {
                const isPlayerColumn = cell.column.id === 'player';
                const isTextColumn = TEXT_COLUMNS.has(cell.column.id);
                const rowBg = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
                return (
                  <td
                    key={cell.id}
                    className={`px-3 py-2 text-sm text-gray-900 whitespace-nowrap
                               ${isTextColumn ? 'text-left' : 'text-right'}
                               ${isPlayerColumn ? `sticky left-0 z-10 ${rowBg} shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]` : ''}`}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Results count */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-500">
        Showing {data.length} results
      </div>
    </div>
  );
}
