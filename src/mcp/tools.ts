import type { Position, ScoringConfig, WeekSummary } from '../types';
import meta from '../generated/dataMeta.json';
import { calculateFantasyPoints } from '../utils/calculations';
import { DATA_END_YEAR, DATA_START_YEAR, DEFAULT_SCORING } from '../utils/constants';
import { normalizeName } from '../utils/names';
import { COUNTING_STATS, Dataset, SCORED_STATS } from './dataset';

export class ToolInputError extends Error {}

type Args = Record<string, unknown>;

const MAX_LIMIT = 100;
const POSITIONS = ['QB', 'RB', 'WR', 'TE'];
const weeklySeasons = meta.weeklySeasons as Record<string, WeekSummary[]>;

const PRESETS: Record<string, Partial<ScoringConfig>> = {
  ppr: { reception: 1 },
  half_ppr: { reception: 0.5 },
  standard: { reception: 0 },
};

const scoringSchema = {
  type: 'object',
  description:
    'Fantasy scoring. Start from a preset (default "ppr") and override any value. Defaults: 25 pass yards per ' +
    'point, 4 per pass TD, -2 per INT, 10 rush/receiving yards per point, 6 per rush/receiving TD, -2 per fumble lost.',
  properties: {
    preset: { type: 'string', enum: Object.keys(PRESETS) },
    passingYardsPerPoint: { type: 'number' },
    passingTD: { type: 'number' },
    interception: { type: 'number' },
    rushingYardsPerPoint: { type: 'number' },
    rushingTD: { type: 'number' },
    rushingCarry: { type: 'number', description: 'Points per carry' },
    receivingYardsPerPoint: { type: 'number' },
    receivingTD: { type: 'number' },
    reception: { type: 'number', description: 'Points per reception' },
    fumbleLost: { type: 'number' },
  },
  additionalProperties: false,
};

const positionSchema = { type: 'string', enum: POSITIONS };
const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

export const TOOL_DEFINITIONS = [
  {
    name: 'get_data_info',
    description:
      'Describes the data: seasons covered, the latest week of the current season, how many games each week has ' +
      'so far, when it last changed, and known caveats. Call this first when freshness matters.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: readOnly,
  },
  {
    name: 'search_players',
    description: 'Finds players by full or partial name. Returns each name, position and the seasons covered.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Full or partial name, such as "mahomes"' },
        position: positionSchema,
        limit: { type: 'integer', minimum: 1, maximum: MAX_LIMIT, description: 'Default 20' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    annotations: readOnly,
  },
  {
    name: 'get_player_stats',
    description:
      'Returns a player\'s regular-season stats by season with career totals and fantasy points. Players who share ' +
      'a name are separated by position.',
    inputSchema: {
      type: 'object',
      properties: {
        player: { type: 'string', description: 'Player name' },
        position: { ...positionSchema, description: 'Narrows the result when players share a name' },
        start_year: { type: 'integer' },
        end_year: { type: 'integer' },
        scoring: scoringSchema,
      },
      required: ['player'],
      additionalProperties: false,
    },
    annotations: readOnly,
  },
  {
    name: 'get_player_weekly',
    description:
      'Returns a player\'s game-by-game stats and fantasy points. Weekly data exists only for seasons listed by ' +
      'get_data_info. Defaults to the latest such season.',
    inputSchema: {
      type: 'object',
      properties: {
        player: { type: 'string', description: 'Player name' },
        position: positionSchema,
        season: { type: 'integer' },
        scoring: scoringSchema,
      },
      required: ['player'],
      additionalProperties: false,
    },
    annotations: readOnly,
  },
  {
    name: 'get_leaders',
    description:
      'Ranks fantasy performances under any scoring. Leave the years out for all-time best seasons. Set "week" for ' +
      'a single week, or group_by "player" to total careers or multi-year spans.',
    inputSchema: {
      type: 'object',
      properties: {
        position: positionSchema,
        year: { type: 'integer', description: 'A single season' },
        start_year: { type: 'integer' },
        end_year: { type: 'integer' },
        week: { type: 'integer', description: 'A single week; requires a "year" with weekly data' },
        group_by: {
          type: 'string',
          enum: ['season', 'player'],
          description: '"season" ranks individual seasons (default); "player" sums each player across the years',
        },
        min_games: { type: 'integer', minimum: 0, description: 'Excludes smaller samples' },
        per_game: { type: 'boolean', description: 'Rank by fantasy points per game' },
        scoring: scoringSchema,
        limit: { type: 'integer', minimum: 1, maximum: MAX_LIMIT, description: 'Default 25' },
      },
      additionalProperties: false,
    },
    annotations: readOnly,
  },
];

function integerArg(args: Args, name: string): number | undefined {
  const value = args[name];
  if (value === undefined || value === null) return undefined;
  if (!Number.isInteger(value)) throw new ToolInputError(`${name} must be an integer`);
  return value as number;
}

function limitArg(args: Args, fallback: number): number {
  const limit = integerArg(args, 'limit') ?? fallback;
  if (limit < 1) throw new ToolInputError('limit must be at least 1');
  return Math.min(limit, MAX_LIMIT);
}

function positionArg(args: Args): Position | undefined {
  const value = args.position;
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || !POSITIONS.includes(value)) {
    throw new ToolInputError(`position must be one of ${POSITIONS.join(', ')}`);
  }
  return value as Position;
}

function nameArg(args: Args, name: string): string {
  const value = args[name];
  const normalized = typeof value === 'string' ? normalizeName(value) : '';
  if (!normalized) throw new ToolInputError(`${name} is required`);
  return normalized;
}

function scoringArg(args: Args): ScoringConfig {
  const input = args.scoring ?? {};
  if (typeof input !== 'object' || input === null) throw new ToolInputError('scoring must be an object');

  const { preset = 'ppr', ...overrides } = input as Args;
  if (typeof preset !== 'string' || !(preset in PRESETS)) {
    throw new ToolInputError(`scoring.preset must be one of ${Object.keys(PRESETS).join(', ')}`);
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (!(key in DEFAULT_SCORING)) throw new ToolInputError(`Unknown scoring option: ${key}`);
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new ToolInputError(`scoring.${key} must be a number`);
    }
  }

  return { ...DEFAULT_SCORING, ...PRESETS[preset], ...(overrides as Partial<ScoringConfig>) };
}

function yearRange(args: Args) {
  const year = integerArg(args, 'year');
  const start = year ?? integerArg(args, 'start_year') ?? DATA_START_YEAR;
  const end = year ?? integerArg(args, 'end_year') ?? DATA_END_YEAR;
  if (start > end) throw new ToolInputError('start_year must not be after end_year');
  return { start, end };
}

function pointsForRow(dataset: Dataset, row: number, scoring: ScoringConfig, scratch: Record<string, number>) {
  for (const stat of SCORED_STATS) scratch[stat] = dataset.get(row, stat);
  return calculateFantasyPoints(scratch as never, scoring);
}

function pointsForTotals(totals: Record<string, number>, scoring: ScoringConfig) {
  return calculateFantasyPoints(totals as never, scoring);
}

const emptyTotals = () => Object.fromEntries(COUNTING_STATS.map((stat) => [stat, 0]));

function addTotals(dataset: Dataset, row: number, totals: Record<string, number>) {
  for (const stat of COUNTING_STATS) totals[stat] += dataset.get(row, stat);
}

function roundTotals(totals: Record<string, number>) {
  return Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, Math.round(v * 10) / 10]));
}

/** Rows whose player matches exactly, or by partial name when that is unambiguous. */
function findPlayerRows(dataset: Dataset, query: string, position: Position | undefined) {
  const exact: number[] = [];
  const partial: number[] = [];
  const partialNames = new Set<string>();
  const names = new Map<number, string>();

  for (let row = 0; row < dataset.rowCount; row++) {
    if (position && dataset.positionOf(row) !== position) continue;

    const id = dataset.get(row, 'player');
    let name = names.get(id);
    if (name === undefined) {
      name = normalizeName(dataset.playerName(row));
      names.set(id, name);
    }

    if (name === query) exact.push(row);
    else if (name.includes(query)) {
      partial.push(row);
      partialNames.add(dataset.playerName(row));
    }
  }

  if (exact.length > 0) return exact;
  if (partialNames.size === 1) return partial;
  if (partialNames.size > 1) {
    const options = [...partialNames].slice(0, 15).join(', ');
    throw new ToolInputError(`"${query}" matches several players: ${options}. Use a full name.`);
  }
  throw new ToolInputError(`No player found for "${query}". Try search_players.`);
}

function getDataInfo() {
  const seasons = Object.keys(weeklySeasons).map(Number);
  const latestSeason = seasons.length ? Math.max(...seasons) : null;
  const latestWeek = latestSeason ? weeklySeasons[latestSeason].at(-1) : null;

  return {
    startYear: DATA_START_YEAR,
    endYear: DATA_END_YEAR,
    updatedAt: (meta as { updatedAt?: string }).updatedAt ?? null,
    latestSeason,
    latestWeek: latestWeek?.week ?? null,
    latestWeekComplete: latestWeek ? latestWeek.gamesPlayed === latestWeek.gamesScheduled : null,
    weeklySeasons,
    positions: POSITIONS,
    defaultScoring: DEFAULT_SCORING,
    sources: {
      historical: 'Pro Football Reference, through the 2025 season',
      weekly: 'nflverse, from the first season listed in weeklySeasons',
    },
    caveats: [
      'Regular season only.',
      'Before 1992, targets are estimates; before 1994, fumbles lost are estimates. Both can be fractional.',
      'gamesStarted is null for nflverse seasons.',
      'A team of "2TM" or "3TM" means the player appeared for that many teams in the season.',
      'A season in progress has fewer games, so compare it with full seasons using per_game.',
    ],
  };
}

function searchPlayers(dataset: Dataset, args: Args) {
  const query = nameArg(args, 'query');
  const position = positionArg(args);
  const limit = limitArg(args, 20);
  const matches = new Map<string, { name: string; position: Position; firstYear: number; lastYear: number }>();
  const names = new Map<number, string>();

  for (let row = 0; row < dataset.rowCount; row++) {
    const id = dataset.get(row, 'player');
    let name = names.get(id);
    if (name === undefined) {
      name = normalizeName(dataset.playerName(row));
      names.set(id, name);
    }
    if (!name.includes(query)) continue;

    const rowPosition = dataset.positionOf(row);
    if (position && rowPosition !== position) continue;

    const year = dataset.get(row, 'year');
    const key = `${id}|${rowPosition}`;
    const match = matches.get(key);
    if (match) {
      match.firstYear = Math.min(match.firstYear, year);
      match.lastYear = Math.max(match.lastYear, year);
    } else {
      matches.set(key, { name: dataset.playerName(row), position: rowPosition, firstYear: year, lastYear: year });
    }
  }

  const players = [...matches.values()].sort((a, b) => b.lastYear - a.lastYear);
  return { total: players.length, players: players.slice(0, limit) };
}

function getPlayerStats(dataset: Dataset, args: Args) {
  const { start, end } = yearRange(args);
  const scoring = scoringArg(args);
  const scratch = {};
  const rows = findPlayerRows(dataset, nameArg(args, 'player'), positionArg(args)).filter(
    (row) =>
      dataset.get(row, 'week') === 0 && dataset.get(row, 'year') >= start && dataset.get(row, 'year') <= end
  );

  const byPlayer = new Map<string, { player: string; position: Position; rows: number[] }>();
  for (const row of rows) {
    const key = `${dataset.playerName(row)}|${dataset.positionOf(row)}`;
    if (!byPlayer.has(key)) {
      byPlayer.set(key, { player: dataset.playerName(row), position: dataset.positionOf(row), rows: [] });
    }
    byPlayer.get(key)!.rows.push(row);
  }

  const careers = [...byPlayer.values()].map(({ player, position, rows: playerRows }) => {
    const totals = emptyTotals();
    const seasons = playerRows
      .map((row) => {
        addTotals(dataset, row, totals);
        return { ...dataset.decode(row), fantasyPoints: pointsForRow(dataset, row, scoring, scratch) };
      })
      .sort((a, b) => a.year - b.year);

    return {
      player,
      position,
      seasons,
      totals: { ...roundTotals(totals), fantasyPoints: pointsForTotals(totals, scoring) },
    };
  });

  return { scoring, careers };
}

function getPlayerWeekly(dataset: Dataset, args: Args) {
  const available = Object.keys(weeklySeasons).map(Number);
  const season = integerArg(args, 'season') ?? Math.max(0, ...available);
  if (!available.includes(season)) {
    throw new ToolInputError(`No weekly data for ${season}. Available: ${available.join(', ') || 'none'}`);
  }

  const scoring = scoringArg(args);
  const scratch = {};
  const games = findPlayerRows(dataset, nameArg(args, 'player'), positionArg(args))
    .filter((row) => dataset.get(row, 'week') > 0 && dataset.get(row, 'year') === season)
    .map((row) => ({ ...dataset.decode(row), fantasyPoints: pointsForRow(dataset, row, scoring, scratch) }))
    .sort((a, b) => a.week! - b.week!);

  return { season, scoring, games };
}

function getLeaders(dataset: Dataset, args: Args) {
  const { start, end } = yearRange(args);
  const position = positionArg(args);
  const scoring = scoringArg(args);
  const limit = limitArg(args, 25);
  const week = integerArg(args, 'week') ?? 0;
  const minGames = integerArg(args, 'min_games') ?? 0;
  const perGame = args.per_game === true;
  const groupBy = args.group_by ?? 'season';

  if (groupBy !== 'season' && groupBy !== 'player') {
    throw new ToolInputError('group_by must be "season" or "player"');
  }
  if (week > 0) {
    if (start !== end) throw new ToolInputError('week requires a single "year"');
    if (!weeklySeasons[start]) throw new ToolInputError(`No weekly data for ${start}`);
  }

  const selected: number[] = [];
  for (let row = 0; row < dataset.rowCount; row++) {
    if (
      dataset.get(row, 'week') === week &&
      dataset.get(row, 'year') >= start &&
      dataset.get(row, 'year') <= end &&
      (!position || dataset.positionOf(row) === position)
    ) {
      selected.push(row);
    }
  }

  const rank = <T extends { fantasyPoints: number; pointsPerGame: number | null; games: number }>(items: T[]) => {
    const metric = (item: T) => (perGame ? (item.pointsPerGame ?? 0) : item.fantasyPoints);
    const eligible = items.filter((item) => item.games >= minGames);

    // All-time queries cover 30,000+ rows against a 10ms CPU budget. A numeric typed
    // array sorts far faster than objects, so use one to find the cutoff first.
    const metrics = Float64Array.from(eligible, metric).sort();
    const cutoff = metrics[Math.max(0, metrics.length - limit)] ?? -Infinity;

    return eligible
      .filter((item) => metric(item) >= cutoff)
      .sort((a, b) => metric(b) - metric(a))
      .slice(0, limit)
      .map((item, index) => ({ rank: index + 1, ...item }));
  };

  const ppg = (points: number, games: number) => (games > 0 ? Math.round((points / games) * 10) / 10 : null);

  if (groupBy === 'player') {
    const groups = new Map<string, { player: string; position: Position; totals: Record<string, number>; seasons: number }>();
    for (const row of selected) {
      const key = `${dataset.get(row, 'player')}|${dataset.get(row, 'position')}`;
      let group = groups.get(key);
      if (!group) {
        group = { player: dataset.playerName(row), position: dataset.positionOf(row), totals: emptyTotals(), seasons: 0 };
        groups.set(key, group);
      }
      group.seasons += 1;
      addTotals(dataset, row, group.totals);
    }

    const leaders = rank(
      [...groups.values()].map(({ player, position: p, totals, seasons }) => {
        const fantasyPoints = pointsForTotals(totals, scoring);
        return {
          player,
          position: p,
          seasons,
          ...roundTotals(totals),
          games: totals.games,
          fantasyPoints,
          pointsPerGame: ppg(fantasyPoints, totals.games),
        };
      })
    );
    return { scoring, years: { start, end }, groupBy, leaders };
  }

  const scratch = {};
  const scored = selected
    .map((row) => {
      const fantasyPoints = pointsForRow(dataset, row, scoring, scratch);
      const games = dataset.get(row, 'games');
      return { row, fantasyPoints, games, pointsPerGame: ppg(fantasyPoints, games) };
    });

  const leaders = rank(scored).map(({ rank: place, row, fantasyPoints, pointsPerGame }) => ({
    rank: place,
    ...dataset.decode(row),
    fantasyPoints,
    pointsPerGame,
  }));

  return { scoring, years: { start, end }, week: week || null, groupBy, leaders };
}

export function callTool(dataset: Dataset, name: string, args: Args): unknown {
  switch (name) {
    case 'get_data_info':
      return getDataInfo();
    case 'search_players':
      return searchPlayers(dataset, args);
    case 'get_player_stats':
      return getPlayerStats(dataset, args);
    case 'get_player_weekly':
      return getPlayerWeekly(dataset, args);
    case 'get_leaders':
      return getLeaders(dataset, args);
    default:
      throw new ToolInputError(`Unknown tool: ${name}`);
  }
}

export const toolExists = (name: string) => TOOL_DEFINITIONS.some((tool) => tool.name === name);
