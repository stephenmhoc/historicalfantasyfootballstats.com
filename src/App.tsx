import { FilterBar } from './components/FilterBar';
import { StatsTable } from './components/StatsTable';
import { ScoringModal } from './components/ScoringModal';
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
        <div className="max-w-7xl mx-auto">
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
      </header>

      {/* Filter Bar */}
      <FilterBar />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full">
        {/* Top 500 note */}
        <p className="text-sm text-gray-500 mb-3">
          Showing top 500 results sorted by fantasy points. Targets before 1992 and fumbles lost
          before 1994 are estimates.
        </p>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <StatsTable />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-200 text-gray-600 py-6 px-4 mt-auto">
        <div className="max-w-7xl mx-auto text-center text-sm">
          <p>
            Made with ❤️ by{' '}
            <a
              href="https://merimerimeri.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 hover:text-emerald-700 underline"
            >
              Stephen Meriwether
            </a>
          </p>
          <p className="mt-2 space-x-4">
            <a
              href="https://x.com/stephenmhoc"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-900"
            >
              Twitter/X
            </a>
            <span className="text-gray-400">•</span>
            <a
              href="https://github.com/smeriwether/historicalfantasyfootballstats.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-900"
            >
              Open source on GitHub
            </a>
          </p>
          <p className="mt-2 text-gray-400">
            Data from{' '}
            <a
              href="https://www.pro-football-reference.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-700 underline"
            >
              Pro Football Reference
            </a>{' '}
            and{' '}
            <a
              href="https://github.com/nflverse/nflverse-data"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-700 underline"
            >
              nflverse
            </a>
          </p>
          <p className="mt-2 text-gray-400">Go Texans!</p>
        </div>
      </footer>

      {/* Scoring Config Modal */}
      <ScoringModal />
    </div>
  );
}

export default App;
