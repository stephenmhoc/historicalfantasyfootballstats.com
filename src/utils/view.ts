import type { PlayerSeason, PlayerSeasonWithPoints, PositionFilter, ScoringConfig, YearFilter } from '../types';
import { calculateFantasyPoints } from './calculations';
import { DEFAULT_POSITION, DEFAULT_SCORING, DEFAULT_YEAR, MAX_RESULTS } from './constants';
import { filterByPosition, filterByYearRange } from './filters';

export interface ViewOptions {
  position: PositionFilter;
  year: YearFilter;
  scoring: ScoringConfig;
}

/** The rows a filter and scoring combination shows, ranked. */
export function computeView(rows: PlayerSeason[], { position, year, scoring }: ViewOptions): PlayerSeasonWithPoints[] {
  const withPoints = filterByYearRange(filterByPosition(rows, position), year).map((player) => ({
    ...player,
    fantasyPoints: calculateFantasyPoints(player, scoring),
    rank: 0, // Placeholder, set after sorting
  }));

  withPoints.sort((a, b) => b.fantasyPoints - a.fantasyPoints);

  const top = withPoints.slice(0, MAX_RESULTS);
  top.forEach((player, index) => {
    player.rank = index + 1;
  });
  return top;
}

export const DEFAULT_VIEW: ViewOptions = {
  position: DEFAULT_POSITION,
  year: DEFAULT_YEAR,
  scoring: DEFAULT_SCORING,
};

export function isDefaultScoring(config: ScoringConfig) {
  return (Object.keys(DEFAULT_SCORING) as (keyof ScoringConfig)[]).every((key) => config[key] === DEFAULT_SCORING[key]);
}

/** The source rows behind the default view, which the build puts in the homepage. */
export function buildDefaultRows(rows: PlayerSeason[]): PlayerSeason[] {
  return computeView(rows, DEFAULT_VIEW).map((row) => {
    const source: PlayerSeason & Partial<PlayerSeasonWithPoints> = { ...row };
    delete source.fantasyPoints;
    delete source.rank;
    return source;
  });
}
