import { FilterBar } from './components/FilterBar';
import { StatsTable } from './components/StatsTable';
import { ScoringModal } from './components/ScoringModal';
import { siteFooter } from './seo/footer';
import {
  DATA_END_YEAR,
  DATA_START_YEAR,
  TOTAL_DATA_YEARS,
  getWeeksForYear,
} from './utils/constants';

function App() {
  const latestWeek = getWeeksForYear(DATA_END_YEAR).at(-1)?.week;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-emerald-800 text-white py-6 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Historical Fantasy Football Stats</h1>
            <p className="text-emerald-200 text-sm mt-1">
              {DATA_START_YEAR}-{DATA_END_YEAR}
              {latestWeek && ` · ${DATA_END_YEAR} through Week ${latestWeek}`}
            </p>
            <p className="text-emerald-100/80 text-sm mt-3 max-w-2xl">
              Compare fantasy football performance across {TOTAL_DATA_YEARS} years of data. Filter by
              position and year, customize your league's scoring settings, and discover the greatest fantasy
              seasons of all time.
            </p>
          </div>
          <a
            href="/explore"
            className="self-start sm:self-center shrink-0 px-4 py-2 text-sm font-medium text-white border border-white/40 rounded-lg
                       hover:bg-white/10 transition-colors"
          >
            Explore all pages →
          </a>
        </div>
      </header>

      {/* Filter Bar */}
      <FilterBar />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full">
        {/* Top 500 note */}
        <p className="text-sm text-gray-500 mb-3">
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
