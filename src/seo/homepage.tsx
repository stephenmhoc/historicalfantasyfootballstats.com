import { renderToStaticMarkup } from 'react-dom/server';
import { FilterBar } from '../components/FilterBar';
import { HomeBody } from '../components/HomeBody';
import { ResultsTable } from '../components/ResultsTable';
import type { PlayerSeasonWithPoints } from '../types';
import { MAX_RESULTS } from '../utils/constants';
import { DEFAULT_SORTING, DEFAULT_VIEW, computeView } from '../utils/view';
import { aboutLinks, statsLinks } from './footer';
import { escapeHtml, miniTable, rank, type SeoData } from './pages';

// Enough rows to fill a tall screen before React renders all 500.
const PRERENDERED_ROWS = 30;

/** A row holding each column's widest value, so columns keep their final widths. */
function widestRow(rows: PlayerSeasonWithPoints[]) {
  const widest = { ...rows[0] };

  for (const row of rows) {
    for (const key of Object.keys(widest) as (keyof PlayerSeasonWithPoints)[]) {
      const [value, best] = [String(row[key] ?? ''), String(widest[key] ?? '')];
      if (value.length > best.length || (value.length === best.length && value > best)) {
        (widest as Record<string, unknown>)[key] = row[key];
      }
    }
  }
  return { ...widest, fantasyPoints: rows.at(-1)!.fantasyPoints - 1 };
}

/** The app's first screen as HTML, so the first paint matches the final page. */
function appShell(data: SeoData) {
  const view = computeView(data.rows, DEFAULT_VIEW);
  const rows = [...view.slice(0, PRERENDERED_ROWS), widestRow(view)];

  return renderToStaticMarkup(
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <FilterBar />
      <HomeBody table={<ResultsTable data={rows} sorting={DEFAULT_SORTING} total={MAX_RESULTS} sizingRow />} />
    </div>
  );
}

/** Real content for the initial homepage HTML. React replaces it on load. */
export function homepageContent(data: SeoData): string {
  const { startYear, endYear } = data.meta;
  const links = [...statsLinks(endYear), ...aboutLinks]
    .map(({ name, path }) => `<li><a href="${path}">${escapeHtml(name)}</a></li>`)
    .join('');

  // Below the fold, for crawlers that do not run JavaScript.
  return (
    appShell(data) +
    `<section class="max-w-7xl mx-auto px-4 py-6 text-sm text-gray-700">` +
    `<p>Compare historical fantasy football data from ${startYear}-${endYear}. Rank every QB, RB, WR, ` +
    `and TE season with PPR, half-PPR, standard, or your own custom scoring, or ` +
    `<a href="/data">download the data</a>.</p>` +
    miniTable(`${endYear} Fantasy Football Leaders`, rank(data.rows.filter((row) => row.year === endYear)).slice(0, 10)) +
    miniTable('Best Fantasy Seasons of All Time', rank(data.rows).slice(0, 10)) +
    `<ul>${links}</ul></section>`
  );
}
