import { describe, it, expect } from 'vitest';
import { calculateFantasyPoints } from './calculations';
import type { PlayerSeason, ScoringConfig } from '../types';
import { DEFAULT_SCORING } from './constants';

// Helper to create a player with all zeros
const createEmptyPlayer = (overrides: Partial<PlayerSeason> = {}): PlayerSeason => ({
  player: 'Test Player',
  team: 'TST',
  position: 'QB',
  age: 25,
  games: 16,
  gamesStarted: 16,
  year: 2023,
  passCmp: 0,
  passAtt: 0,
  passYds: 0,
  passTD: 0,
  passInt: 0,
  rushAtt: 0,
  rushYds: 0,
  rushTD: 0,
  recTgt: 0,
  rec: 0,
  recYds: 0,
  recTD: 0,
  fmb: 0,
  fmbLost: 0,
  ...overrides,
});

describe('calculateFantasyPoints', () => {
  describe('passing stats', () => {
    it('calculates passing yards correctly (default: 1 point per 25 yards)', () => {
      const player = createEmptyPlayer({ passYds: 250 });
      const points = calculateFantasyPoints(player, DEFAULT_SCORING);
      expect(points).toBe(10); // 250 / 25 = 10
    });

    it('calculates passing TDs correctly (default: 4 points)', () => {
      const player = createEmptyPlayer({ passTD: 3 });
      const points = calculateFantasyPoints(player, DEFAULT_SCORING);
      expect(points).toBe(12); // 3 * 4 = 12
    });

    it('calculates interceptions correctly (default: -2 points)', () => {
      const player = createEmptyPlayer({ passInt: 2 });
      const points = calculateFantasyPoints(player, DEFAULT_SCORING);
      expect(points).toBe(-4); // 2 * -2 = -4
    });
  });

  describe('rushing stats', () => {
    it('calculates rushing yards correctly (default: 1 point per 10 yards)', () => {
      const player = createEmptyPlayer({ rushYds: 150 });
      const points = calculateFantasyPoints(player, DEFAULT_SCORING);
      expect(points).toBe(15); // 150 / 10 = 15
    });

    it('calculates rushing TDs correctly (default: 6 points)', () => {
      const player = createEmptyPlayer({ rushTD: 2 });
      const points = calculateFantasyPoints(player, DEFAULT_SCORING);
      expect(points).toBe(12); // 2 * 6 = 12
    });

    it('calculates rushing carries with default scoring (0 points per carry)', () => {
      const player = createEmptyPlayer({ rushAtt: 20 });
      const points = calculateFantasyPoints(player, DEFAULT_SCORING);
      expect(points).toBe(0); // 20 * 0 = 0 (default)
    });

    it('calculates rushing carries with points per carry', () => {
      const ppcScoring: ScoringConfig = { ...DEFAULT_SCORING, rushingCarry: 0.1 };
      const player = createEmptyPlayer({ rushAtt: 20 });
      const points = calculateFantasyPoints(player, ppcScoring);
      expect(points).toBe(2); // 20 * 0.1 = 2
    });
  });

  describe('receiving stats', () => {
    it('calculates receiving yards correctly (default: 1 point per 10 yards)', () => {
      const player = createEmptyPlayer({ recYds: 100 });
      const points = calculateFantasyPoints(player, DEFAULT_SCORING);
      expect(points).toBe(10); // 100 / 10 = 10
    });

    it('calculates receiving TDs correctly (default: 6 points)', () => {
      const player = createEmptyPlayer({ recTD: 1 });
      const points = calculateFantasyPoints(player, DEFAULT_SCORING);
      expect(points).toBe(6); // 1 * 6 = 6
    });

    it('calculates receptions with PPR scoring (default: 1 point per reception)', () => {
      const player = createEmptyPlayer({ rec: 10 });
      const points = calculateFantasyPoints(player, DEFAULT_SCORING);
      expect(points).toBe(10); // 10 * 1 = 10 (PPR scoring)
    });

    it('calculates receptions with standard scoring (0 points per reception)', () => {
      const standardScoring: ScoringConfig = { ...DEFAULT_SCORING, reception: 0 };
      const player = createEmptyPlayer({ rec: 10 });
      const points = calculateFantasyPoints(player, standardScoring);
      expect(points).toBe(0); // 10 * 0 = 0
    });

    it('calculates receptions with half-PPR scoring (0.5 points per reception)', () => {
      const halfPprScoring: ScoringConfig = { ...DEFAULT_SCORING, reception: 0.5 };
      const player = createEmptyPlayer({ rec: 10 });
      const points = calculateFantasyPoints(player, halfPprScoring);
      expect(points).toBe(5); // 10 * 0.5 = 5
    });
  });

  describe('fumbles', () => {
    it('calculates fumbles lost correctly (default: -2 points)', () => {
      const player = createEmptyPlayer({ fmbLost: 3 });
      const points = calculateFantasyPoints(player, DEFAULT_SCORING);
      expect(points).toBe(-6); // 3 * -2 = -6
    });
  });

  describe('combined stats', () => {
    it('calculates a complete QB season correctly', () => {
      // Lamar Jackson 2024-ish stats
      const player = createEmptyPlayer({
        position: 'QB',
        passYds: 4000,
        passTD: 40,
        passInt: 5,
        rushYds: 900,
        rushTD: 5,
        fmbLost: 3,
      });

      const points = calculateFantasyPoints(player, DEFAULT_SCORING);
      // 4000/25 = 160 (pass yds)
      // 40*4 = 160 (pass TD)
      // 5*-2 = -10 (INT)
      // 900/10 = 90 (rush yds)
      // 5*6 = 30 (rush TD)
      // 3*-2 = -6 (fumbles)
      // Total: 160 + 160 - 10 + 90 + 30 - 6 = 424
      expect(points).toBe(424);
    });

    it('calculates a complete WR season correctly with PPR', () => {
      const pprScoring: ScoringConfig = { ...DEFAULT_SCORING, reception: 1 };
      const player = createEmptyPlayer({
        position: 'WR',
        rec: 100,
        recYds: 1500,
        recTD: 12,
        rushYds: 50,
        fmbLost: 1,
      });

      const points = calculateFantasyPoints(player, pprScoring);
      // 100*1 = 100 (receptions PPR)
      // 1500/10 = 150 (rec yds)
      // 12*6 = 72 (rec TD)
      // 50/10 = 5 (rush yds)
      // 1*-2 = -2 (fumbles)
      // Total: 100 + 150 + 72 + 5 - 2 = 325
      expect(points).toBe(325);
    });

    it('calculates a complete RB season correctly with PPR', () => {
      const player = createEmptyPlayer({
        position: 'RB',
        rushYds: 1200,
        rushTD: 10,
        rec: 50,
        recYds: 400,
        recTD: 3,
        fmbLost: 2,
      });

      const points = calculateFantasyPoints(player, DEFAULT_SCORING);
      // 1200/10 = 120 (rush yds)
      // 10*6 = 60 (rush TD)
      // 50*1 = 50 (receptions - PPR default)
      // 400/10 = 40 (rec yds)
      // 3*6 = 18 (rec TD)
      // 2*-2 = -4 (fumbles)
      // Total: 120 + 60 + 50 + 40 + 18 - 4 = 284
      expect(points).toBe(284);
    });
  });

  describe('custom scoring configurations', () => {
    it('handles custom passing yards per point', () => {
      const customScoring: ScoringConfig = { ...DEFAULT_SCORING, passingYardsPerPoint: 20 };
      const player = createEmptyPlayer({ passYds: 200 });
      const points = calculateFantasyPoints(player, customScoring);
      expect(points).toBe(10); // 200 / 20 = 10
    });

    it('handles 6-point passing TDs', () => {
      const customScoring: ScoringConfig = { ...DEFAULT_SCORING, passingTD: 6 };
      const player = createEmptyPlayer({ passTD: 2 });
      const points = calculateFantasyPoints(player, customScoring);
      expect(points).toBe(12); // 2 * 6 = 12
    });

    it('handles zero penalty for interceptions', () => {
      const customScoring: ScoringConfig = { ...DEFAULT_SCORING, interception: 0 };
      const player = createEmptyPlayer({ passInt: 5 });
      const points = calculateFantasyPoints(player, customScoring);
      expect(points).toBe(0); // 5 * 0 = 0
    });
  });

  describe('edge cases', () => {
    it('does not score yards when yards per point is 0', () => {
      const scoring: ScoringConfig = { ...DEFAULT_SCORING, passingYardsPerPoint: 0 };
      const player = createEmptyPlayer({ passYds: 300, passTD: 1 });
      expect(calculateFantasyPoints(player, scoring)).toBe(4);
    });

    it('returns 0 for a player with no stats', () => {
      const player = createEmptyPlayer();
      const points = calculateFantasyPoints(player, DEFAULT_SCORING);
      expect(points).toBe(0);
    });

    it('handles decimal results correctly (rounds to 1 decimal place)', () => {
      const player = createEmptyPlayer({ passYds: 123 });
      const points = calculateFantasyPoints(player, DEFAULT_SCORING);
      // 123 / 25 = 4.92
      expect(points).toBe(4.9);
    });
  });
});
