import { FilterBar } from './components/FilterBar';
import { StatsTable } from './components/StatsTable';
import { ScoringModal } from './components/ScoringModal';
import { siteFooter } from './seo/footer';
import { DATA_END_YEAR } from './utils/constants';

function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Filter Bar */}
      <FilterBar />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full min-h-screen">
        {/* Top 500 note */}
        <p className="text-sm text-gray-600 mb-3">
          Showing top 500 results sorted by fantasy points. Targets before 1992 and fumbles lost
          before 1994 are estimates.
          {' '}
          <a href="/data" className="text-emerald-700 hover:text-emerald-900 underline">
            Download the data
          </a>
          .
        </p>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <StatsTable />
        </div>
      </main>

      {/* Trusted, static markup shared with the generated pages. */}
      <div className="mt-auto" dangerouslySetInnerHTML={{ __html: siteFooter(DATA_END_YEAR) }} />

      {/* Scoring Config Modal */}
      <ScoringModal />
    </div>
  );
}

export default App;
