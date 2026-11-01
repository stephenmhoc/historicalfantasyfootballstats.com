import dataMeta from '../generated/dataMeta.json';
import type { ScoringConfig, PositionFilter, WeekSummary, YearFilter } from '../types';

export const DEFAULT_SCORING: ScoringConfig = {
  passingYardsPerPoint: 25,
  passingTD: 4,
  interception: -2,
  rushingYardsPerPoint: 10,
  rushingTD: 6,
  rushingCarry: 0, // Points per carry (0 = standard)
  receivingYardsPerPoint: 10,
  receivingTD: 6,
  reception: 1, // PPR scoring (0 = standard, 0.5 = half-PPR, 1 = full PPR)
  fumbleLost: -2,
};

export const POSITIONS: PositionFilter[] = ['All', 'QB', 'RB', 'WR', 'TE'];

export const DATA_START_YEAR = dataMeta.startYear;
export const DATA_END_YEAR = dataMeta.endYear;
export const TOTAL_DATA_YEARS = DATA_END_YEAR - DATA_START_YEAR + 1;

const WEEKLY_SEASONS = dataMeta.weeklySeasons as Record<string, WeekSummary[]>;

export function getWeeksForYear(year: YearFilter): WeekSummary[] {
  return typeof year === 'number' ? (WEEKLY_SEASONS[year] ?? []) : [];
}

export const YEAR_FILTERS: { value: YearFilter; label: string }[] = [
  { value: 'Last36', label: 'Last 36 Years' },
  { value: 'AllYears', label: `All ${TOTAL_DATA_YEARS} Years` },
  { value: '2020s', label: "2020's" },
  { value: '2010s', label: "2010's" },
  { value: '2000s', label: "2000's" },
  { value: '1990s', label: "1990's" },
  { value: '1980s', label: "1980's" },
  { value: '1970s', label: "1970's" },
];

// Generate individual years from the current data range.
export const INDIVIDUAL_YEARS: { value: number; label: string }[] = Array.from(
  { length: TOTAL_DATA_YEARS },
  (_, i) => {
    const year = DATA_END_YEAR - i;
    return { value: year, label: String(year) };
  }
);

export const MAX_RESULTS = 500;
