import type { PlayerSeason } from '../types';
import { scored, type Scored } from './pages';

export interface CsvField {
  name: string;
  description: string;
  value: (row: Scored) => string | number | null | undefined;
}

const stat = (key: keyof PlayerSeason, name: string, description: string): CsvField => ({
  name,
  description,
  value: (row) => row[key],
});

export const CSV_FIELDS: CsvField[] = [
  stat('year', 'year', 'NFL season'),
  stat('week', 'week', 'Week number (weekly files only)'),
  stat('player', 'player', 'Player name'),
  stat('team', 'team', 'Team, or 2TM/3TM for a season split between teams'),
  stat('opponent', 'opponent', 'Opponent (weekly files only)'),
  stat('position', 'position', 'QB, RB, WR, or TE'),
  stat('age', 'age', 'Age during the season'),
  stat('games', 'games', 'Games played'),
  stat('gamesStarted', 'games_started', 'Games started (blank from 2026 on)'),
  stat('passCmp', 'pass_cmp', 'Pass completions'),
  stat('passAtt', 'pass_att', 'Pass attempts'),
  stat('passYds', 'pass_yds', 'Passing yards'),
  stat('passTD', 'pass_td', 'Passing touchdowns'),
  stat('passInt', 'pass_int', 'Interceptions thrown'),
  stat('rushAtt', 'rush_att', 'Rushing attempts'),
  stat('rushYds', 'rush_yds', 'Rushing yards'),
  stat('rushTD', 'rush_td', 'Rushing touchdowns'),
  stat('recTgt', 'rec_tgt', 'Targets (estimated before 1992)'),
  stat('rec', 'rec', 'Receptions'),
  stat('recYds', 'rec_yds', 'Receiving yards'),
  stat('recTD', 'rec_td', 'Receiving touchdowns'),
  stat('fmb', 'fumbles', 'Fumbles'),
  stat('fmbLost', 'fumbles_lost', 'Fumbles lost (estimated before 1994)'),
  { name: 'ppr_points', description: 'Fantasy points, 1 per reception', value: (row) => row.ppr.toFixed(1) },
  { name: 'half_ppr_points', description: 'Fantasy points, 0.5 per reception', value: (row) => row.half.toFixed(1) },
  { name: 'standard_points', description: 'Fantasy points, no reception points', value: (row) => row.standard.toFixed(1) },
];

const WEEKLY_ONLY = new Set(['week', 'opponent']);

function escapeCell(value: string | number | null | undefined) {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Newest first, then by PPR points, so a file reads usefully from the top. */
export function toCsv(rows: PlayerSeason[], { weekly = false } = {}): string {
  const fields = CSV_FIELDS.filter(({ name }) => weekly || !WEEKLY_ONLY.has(name));
  const sorted = rows
    .map(scored)
    .sort((a, b) => b.year - a.year || (b.week ?? 0) - (a.week ?? 0) || b.ppr - a.ppr);
  const lines = [fields.map(({ name }) => name), ...sorted.map((row) => fields.map(({ value }) => escapeCell(value(row))))];

  return `${lines.map((line) => line.join(',')).join('\n')}\n`;
}

export interface CsvFile {
  fileName: string;
  source: string;
}

export function buildCsvFiles({ rows, weekly }: { rows: PlayerSeason[]; weekly: PlayerSeason[] }): CsvFile[] {
  const years = [...new Set(rows.map(({ year }) => year))];
  const weeklyYears = [...new Set(weekly.map(({ year }) => year))];

  return [
    { fileName: 'data/csv/all-seasons.csv', source: toCsv(rows) },
    ...years.map((year) => ({ fileName: `data/csv/${year}.csv`, source: toCsv(rows.filter((row) => row.year === year)) })),
    ...weeklyYears.map((year) => ({
      fileName: `data/csv/weekly-${year}.csv`,
      source: toCsv(weekly.filter((row) => row.year === year), { weekly: true }),
    })),
  ];
}
