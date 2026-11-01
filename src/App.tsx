import { FilterBar } from './components/FilterBar';
import { HomeBody } from './components/HomeBody';
import { StatsTable } from './components/StatsTable';
import { ScoringModal } from './components/ScoringModal';
import { siteFooter } from './seo/footer';
import { DATA_END_YEAR } from './utils/constants';

function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Filter Bar */}
      <FilterBar />

      <HomeBody table={<StatsTable />} />

      {/* Trusted, static markup shared with the generated pages. */}
      <div className="mt-auto" dangerouslySetInnerHTML={{ __html: siteFooter(DATA_END_YEAR) }} />

      {/* Scoring Config Modal */}
      <ScoringModal />
    </div>
  );
}

export default App;
