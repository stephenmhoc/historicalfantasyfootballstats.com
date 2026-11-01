import type { ReactNode } from 'react';

/** The homepage below the filter bar, shared by the app and the prerendered page. */
export function HomeBody({ table }: { table: ReactNode }) {
  return (
    <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full min-h-screen">
      <p className="text-sm text-gray-600 mb-3">
        Showing top 500 results sorted by fantasy points. Targets before 1992 and fumbles lost
        before 1994 are estimates.{' '}
        <a href="/data" className="text-emerald-700 hover:text-emerald-900 underline">
          Download the data
        </a>
        .
      </p>
      <div className="bg-white rounded-lg shadow overflow-hidden">{table}</div>
    </main>
  );
}
