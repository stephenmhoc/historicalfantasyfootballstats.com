import { describe, expect, it } from 'vitest';
import { assertPlausibleUpdate, currentSeason, normalizeName, transformSeason } from './nflverse.js';

const statRow = (overrides = {}) => ({
  player_id: 'p1',
  player_display_name: 'Test Player Jr.',
  position: 'WR',
  week: '1',
  season_type: 'REG',
  game_id: 'g1',
  team: 'KC',
  opponent_team: 'LA',
  completions: '0',
  attempts: '0',
  passing_yards: '0',
  passing_tds: '0',
  passing_interceptions: '0',
  carries: '1',
  rushing_yards: '5',
  rushing_tds: '0',
  receptions: '4',
  targets: '6',
  receiving_yards: '50',
  receiving_tds: '1',
  fumbles_total: '1',
  fumbles_lost_total: '0',
  ...overrides,
});

const players = [{ gsis_id: 'p1', pfr_id: 'pfr1', birth_date: '2000-05-01', first_name: 'Test', last_name: 'Player' }];
const transform = (weeklyRows, extra = {}) =>
  transformSeason({ season: 2026, weeklyRows, players, snapRows: [], existingRows: [], ...extra });

describe('transformSeason', () => {
  it('maps a stat line and team codes to PFR conventions', () => {
    const { weekly } = transform([statRow()]);
    expect(weekly[0]).toMatchObject({ team: 'KAN', opponent: 'LAR', age: 26, week: 1, rec: 4, recTD: 1 });
  });

  it('sums season totals and marks multi-team players', () => {
    const { seasonRows } = transform([
      statRow(),
      statRow({ week: '2', game_id: 'g2', team: 'SF', receiving_yards: '20' }),
    ]);
    expect(seasonRows).toHaveLength(1);
    expect(seasonRows[0]).toMatchObject({ team: '2TM', games: 2, recYds: 70, gamesStarted: null });
  });

  it('prefers snap counts for games played', () => {
    const snapRows = ['g1', 'g2', 'g3'].map((game_id) => ({
      game_id, game_type: 'REG', pfr_player_id: 'pfr1', offense_snaps: '3', defense_snaps: '0', st_snaps: '0',
    }));
    expect(transform([statRow()], { snapRows }).seasonRows[0].games).toBe(3);
  });

  it('ignores the postseason and players at other positions', () => {
    const { weekly } = transform([
      statRow({ season_type: 'POST' }),
      statRow({ position: 'K', player_id: 'p2' }),
    ]);
    expect(weekly).toEqual([]);
  });

  it('treats fullbacks as running backs', () => {
    expect(transform([statRow({ position: 'FB' })]).weekly[0].position).toBe('RB');
  });

  it('keeps the most recent spelling of an existing player', () => {
    const existingRows = [
      { player: 'Test Player', position: 'WR', year: 2025 },
      { player: 'Old Spelling', position: 'WR', year: 2022 },
    ];
    expect(transform([statRow()], { existingRows }).weekly[0].player).toBe('Test Player');
  });

  it('reports games played against the schedule', () => {
    const schedule = [
      { season: '2026', week: '1', game_type: 'REG' },
      { season: '2026', week: '1', game_type: 'REG' },
      { season: '2025', week: '1', game_type: 'REG' },
    ];
    expect(transform([statRow()], { schedule }).weeks).toEqual([
      { week: 1, gamesPlayed: 1, gamesScheduled: 2 },
    ]);
  });
});

describe('normalizeName', () => {
  it('ignores punctuation, accents and suffixes', () => {
    expect(normalizeName('D.J. Moore')).toBe(normalizeName('DJ Moore'));
    expect(normalizeName('Audric Estimé')).toBe('audric estime');
    expect(normalizeName('Marvin Harrison Jr.')).toBe('marvin harrison');
    expect(normalizeName('Amon-Ra St. Brown')).toBe('amon ra st brown');
  });
});

describe('currentSeason', () => {
  it('rolls over in September, keeping January in the prior season', () => {
    expect(currentSeason(new Date('2026-08-31T00:00:00Z'))).toBe(2025);
    expect(currentSeason(new Date('2026-09-01T00:00:00Z'))).toBe(2026);
    expect(currentSeason(new Date('2027-01-15T00:00:00Z'))).toBe(2026);
  });
});

describe('assertPlausibleUpdate', () => {
  const rows = (count, week) => Array.from({ length: count }, () => ({ week }));

  it('accepts growth and small corrections', () => {
    const check = (next) => assertPlausibleUpdate({ season: 2026, previousWeekly: rows(100, 5), nextWeekly: next });
    expect(() => check(rows(120, 6))).not.toThrow();
    expect(() => check(rows(95, 5))).not.toThrow();
  });

  it('rejects a feed that lost weeks or rows', () => {
    const check = (next) => assertPlausibleUpdate({ season: 2026, previousWeekly: rows(100, 5), nextWeekly: next });
    expect(() => check(rows(100, 4))).toThrow(/week/);
    expect(() => check(rows(50, 5))).toThrow(/shrank/);
  });
});
