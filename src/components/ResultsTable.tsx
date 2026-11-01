import { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type OnChangeFn,
  type SortingState,
} from '@tanstack/react-table';
import type { PlayerSeasonWithPoints } from '../types';
import { useFantasyStore } from '../stores/fantasyStore';
import { getColumnsForPosition } from '../utils/columns';

const TEXT_COLUMNS = new Set(['rank', 'player', 'team', 'year', 'week', 'opponent']);

const ARIA_SORT = { asc: 'ascending', desc: 'descending' } as const;

interface ResultsTableProps {
  data: PlayerSeasonWithPoints[];
  sorting: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  /** Result count to show, when `data` is only the first rows of the results. */
  total?: number;
  /** Keeps the last row out of sight, where it only sets the column widths. */
  sizingRow?: boolean;
}

/** The results table. The build also uses it to prerender the homepage. */
export function ResultsTable({ data, sorting, onSortingChange, total = data.length, sizingRow = false }: ResultsTableProps) {
  const positionFilter = useFantasyStore((state) => state.positionFilter);
  const weekFilter = useFantasyStore((state) => state.weekFilter);
  const showWeek = typeof weekFilter === 'number';

  const columns = useMemo(
    () => getColumnsForPosition(positionFilter, showWeek),
    [positionFilter, showWeek]
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

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
          {table.getRowModel().rows.map((row, index, rows) => (
            <tr
              key={row.id}
              aria-hidden={sizingRow && index === rows.length - 1 ? true : undefined}
              className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                         ${sizingRow && index === rows.length - 1 ? 'collapse' : ''}`}
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
        Showing {total} results
      </div>
    </div>
  );
}
