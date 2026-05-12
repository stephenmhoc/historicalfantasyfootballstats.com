import type { PlayerSeason, PositionFilter, YearFilter } from '../types';
import { DATA_END_YEAR, DATA_START_YEAR } from './constants';

export function filterByPosition(
  data: PlayerSeason[],
  position: PositionFilter
): PlayerSeason[] {
  if (position === 'All') return data;
  return data.filter((p) => p.position === position);
}

export function filterByYearRange(
  data: PlayerSeason[],
  yearFilter: YearFilter
): PlayerSeason[] {
  if (typeof yearFilter === 'number') {
    return data.filter((p) => p.year === yearFilter);
  }

  switch (yearFilter) {
    case 'AllYears':
    case 'Last56':
    case 'Last55':
      return data.filter((p) => p.year >= DATA_START_YEAR && p.year <= DATA_END_YEAR);
    case 'Last36':
    case 'Last35':
      return filterByRecentYears(data, 36);
    case '2020s':
      return data.filter((p) => p.year >= 2020 && p.year <= 2029);
    case '2010s':
      return data.filter((p) => p.year >= 2010 && p.year <= 2019);
    case '2000s':
      return data.filter((p) => p.year >= 2000 && p.year <= 2009);
    case '1990s':
      return data.filter((p) => p.year >= 1990 && p.year <= 1999);
    case '1980s':
      return data.filter((p) => p.year >= 1980 && p.year <= 1989);
    case '1970s':
      return data.filter((p) => p.year >= 1970 && p.year <= 1979);
    default:
      return data;
  }
}

function filterByRecentYears(data: PlayerSeason[], years: number): PlayerSeason[] {
  const startYear = DATA_END_YEAR - years + 1;
  return data.filter((p) => p.year >= startYear && p.year <= DATA_END_YEAR);
}
