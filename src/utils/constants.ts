import type { ScoringConfig, PositionFilter, YearFilter } from '../types';

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

export const DATA_START_YEAR = 1970;
export const DATA_END_YEAR = 2025;
export const TOTAL_DATA_YEARS = DATA_END_YEAR - DATA_START_YEAR + 1;

export const YEAR_FILTERS: { value: YearFilter; label: string }[] = [
  { value: 'Last36', label: 'Last 36 Years' },
  { value: 'Last56', label: 'Last 56 Years' },
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
