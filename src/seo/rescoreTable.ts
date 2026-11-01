import type { PlayerSeason, ScoringConfig } from '../types';
import { calculateFantasyPoints } from '../utils/calculations';
import { isDefaultScoring } from '../utils/view';

/** Order of the values in a row's data-stats attribute. */
export const STAT_KEYS = ['passYds', 'passTD', 'passInt', 'rushAtt', 'rushYds', 'rushTD', 'rec', 'recYds', 'recTD', 'fmbLost'] as const;

const CUSTOM_CLASS = 'your-score';

function scoreRow(row: HTMLTableRowElement, config: ScoringConfig) {
  const values = row.dataset.stats!.split(',').map(Number);
  const stats = Object.fromEntries(STAT_KEYS.map((key, index) => [key, values[index]]));
  return calculateFantasyPoints(stats as unknown as PlayerSeason, config);
}

/**
 * Applies the visitor's scoring to a generated table. Default scoring restores
 * the published table. Anything else adds a column and reranks the listed rows.
 * Returns whether a custom score is showing.
 */
export function rescoreTable(table: HTMLTableElement, config: ScoringConfig): boolean {
  const body = table.tBodies[0];
  const rows = [...body.rows].filter((row) => row.dataset.stats);
  const headings = table.tHead!.rows[0];
  const pprIndex = [...headings.cells].findIndex((cell) => cell.textContent === 'PPR');

  table.querySelectorAll(`.${CUSTOM_CLASS}`).forEach((cell) => cell.remove());
  const custom = !isDefaultScoring(config);

  if (custom) {
    const heading = document.createElement('th');
    heading.scope = 'col';
    heading.className = CUSTOM_CLASS;
    heading.textContent = 'Your Score';
    headings.insertBefore(heading, headings.cells[pprIndex]);
  }

  const ordered = rows
    .map((row) => ({ row, score: scoreRow(row, config), published: Number(row.dataset.rank) }))
    .sort((a, b) => (custom ? b.score - a.score || a.published - b.published : a.published - b.published));

  ordered.forEach(({ row, score }, index) => {
    row.cells[0].textContent = String(index + 1);
    if (custom) {
      const cell = document.createElement('td');
      cell.className = CUSTOM_CLASS;
      cell.textContent = score.toFixed(1);
      row.insertBefore(cell, row.cells[pprIndex]);
    }
    body.appendChild(row);
  });

  return custom;
}
