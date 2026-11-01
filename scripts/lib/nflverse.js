// Pure transforms from nflverse CSV rows to this site's PlayerSeason shape.
// Kept free of I/O so they can be unit tested and validated against PFR data.

export const REQUIRED_WEEKLY_COLUMNS = [
  'player_id', 'player_display_name', 'position', 'week', 'season_type', 'game_id', 'team',
  'opponent_team', 'completions', 'attempts', 'passing_yards', 'passing_tds',
  'passing_interceptions', 'carries', 'rushing_yards', 'rushing_tds', 'receptions', 'targets',
  'receiving_yards', 'receiving_tds', 'fumbles_total', 'fumbles_lost_total',
];

// nflverse abbreviations that differ from the PFR ones used by the historical data.
const TEAM_CODES = { GB: 'GNB', KC: 'KAN', LA: 'LAR', LV: 'LVR', NE: 'NWE', NO: 'NOR', SF: 'SFO', TB: 'TAM' };

// PFR's fantasy positions have no FB, so fullbacks count as RBs in the historical data.
const POSITIONS = { QB: 'QB', RB: 'RB', FB: 'RB', WR: 'WR', TE: 'TE' };

// Two-way players nflverse lists on defense, keyed by gsis id.
const POSITION_OVERRIDES = { '00-0040718': 'WR' }; // Travis Hunter

const STAT_COLUMNS = {
  passCmp: 'completions',
  passAtt: 'attempts',
  passYds: 'passing_yards',
  passTD: 'passing_tds',
  passInt: 'passing_interceptions',
  rushAtt: 'carries',
  rushYds: 'rushing_yards',
  rushTD: 'rushing_tds',
  recTgt: 'targets',
  rec: 'receptions',
  recYds: 'receiving_yards',
  recTD: 'receiving_tds',
  fmb: 'fumbles_total',
  fmbLost: 'fumbles_lost_total',
};
const STATS = Object.keys(STAT_COLUMNS);

export const teamCode = (team) => TEAM_CODES[team] ?? team;

export function normalizeName(name) {
  return String(name)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.'’]/g, '')
    .replace(/-/g, ' ')
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function statNumber(value, column) {
  if (value === undefined || value === '' || value === 'NA') return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid value for ${column}: "${value}"`);
  return parsed;
}

function hasOffensiveStats(row) {
  return ['passAtt', 'rushAtt', 'recTgt', 'rec', 'fmb'].some((stat) => row[stat] !== 0);
}

/**
 * Maps nflverse spellings onto the names already used for a player, so a career
 * stays one player ("Chris Godwin Jr." -> "Chris Godwin", "DJ Moore" -> "D.J. Moore").
 */
function createNameResolver(existingRows, season) {
  const known = new Map();
  const remember = (key, player) => {
    if (!known.has(key)) known.set(key, player);
  };
  const recentFirst = existingRows
    .filter((row) => row.year >= season - 4 && row.year !== season)
    .sort((a, b) => b.year - a.year);

  for (const row of recentFirst) {
    const name = normalizeName(row.player);
    remember(`${name}|${row.position}`, row.player);
    remember(name, row.player);
  }

  return (candidates, position) => {
    const names = candidates.map(normalizeName);
    const matches = [...names.map((name) => `${name}|${position}`), ...names];
    const match = matches.find((key) => known.has(key));
    return match ? known.get(match) : candidates[0];
  };
}

export function transformSeason({ season, weeklyRows, players, snapRows, existingRows, schedule = [] }) {
  const playersById = new Map(players.map((player) => [player.gsis_id, player]));
  const resolveName = createNameResolver(existingRows, season);

  const snapGames = new Map();
  for (const snap of snapRows) {
    if (snap.game_type !== 'REG' || !snap.pfr_player_id) continue;
    const snaps = ['offense_snaps', 'defense_snaps', 'st_snaps'].reduce(
      (total, column) => total + statNumber(snap[column], column), 0
    );
    if (snaps === 0) continue;
    if (!snapGames.has(snap.pfr_player_id)) snapGames.set(snap.pfr_player_id, new Set());
    snapGames.get(snap.pfr_player_id).add(snap.game_id);
  }

  const gamesByWeek = new Map();
  const seasons = new Map();
  const weekly = [];

  for (const source of weeklyRows) {
    if (source.season_type !== 'REG') continue;

    const week = Number(source.week);
    if (!gamesByWeek.has(week)) gamesByWeek.set(week, new Set());
    gamesByWeek.get(week).add(source.game_id);

    const position = POSITION_OVERRIDES[source.player_id] ?? POSITIONS[source.position];
    if (!position) continue;

    const stats = {};
    for (const stat of STATS) stats[stat] = statNumber(source[STAT_COLUMNS[stat]], STAT_COLUMNS[stat]);
    if (!hasOffensiveStats(stats)) continue;

    const bio = playersById.get(source.player_id);
    const birthYear = Number(bio?.birth_date?.slice(0, 4));
    const aliases = [bio?.football_name, bio?.common_first_name, bio?.first_name]
      .filter(Boolean)
      .map((first) => `${first} ${bio.last_name}`);
    const player = resolveName([source.player_display_name, ...aliases], position);
    const age = birthYear ? season - birthYear : 0;

    const row = {
      player,
      team: teamCode(source.team),
      position,
      age,
      games: 1,
      gamesStarted: null, // Not published by nflverse.
      year: season,
      ...stats,
      week,
      opponent: teamCode(source.opponent_team),
    };
    weekly.push(row);

    if (!seasons.has(source.player_id)) {
      seasons.set(source.player_id, { rows: [], pfrId: bio?.pfr_id });
    }
    seasons.get(source.player_id).rows.push(row);
  }

  const seasonRows = [...seasons.values()].map(({ rows, pfrId }) => {
    const latest = rows.reduce((a, b) => (b.week > a.week ? b : a));
    const teams = new Set(rows.map((row) => row.team));
    const totals = Object.fromEntries(
      STATS.map((stat) => [stat, rows.reduce((total, row) => total + row[stat], 0)])
    );

    return {
      player: latest.player,
      team: teams.size > 1 ? `${teams.size}TM` : latest.team,
      position: latest.position,
      age: latest.age,
      // A stat line proves a game was played, but blockers and special-teamers often
      // have none, so snap counts are the better source when they are available.
      games: Math.max(rows.length, snapGames.get(pfrId)?.size ?? 0),
      gamesStarted: null,
      year: season,
      ...totals,
    };
  });

  const scheduled = new Map();
  for (const game of schedule) {
    if (Number(game.season) === season && game.game_type === 'REG') {
      const week = Number(game.week);
      scheduled.set(week, (scheduled.get(week) ?? 0) + 1);
    }
  }

  const weeks = [...gamesByWeek.entries()]
    .map(([week, games]) => ({
      week,
      gamesPlayed: games.size,
      gamesScheduled: scheduled.get(week) ?? null,
    }))
    .sort((a, b) => a.week - b.week);

  return {
    weekly: weekly.sort((a, b) => a.week - b.week || roughFantasyPoints(b) - roughFantasyPoints(a)),
    seasonRows: seasonRows.sort((a, b) => roughFantasyPoints(b) - roughFantasyPoints(a)),
    weeks,
  };
}

/** False for roster-only rows, such as a traded player's team where he never played. */
export function hasPlayed(row) {
  return row.games > 0 || STATS.some((stat) => row[stat]);
}

export function roughFantasyPoints(row) {
  return (
    row.passYds / 25 + row.passTD * 4 + row.rushYds / 10 + row.rushTD * 6 + row.recYds / 10 + row.recTD * 6
  );
}

/** The NFL season a date belongs to: January games still count toward the previous year. */
export function currentSeason(date = new Date()) {
  return date.getUTCMonth() >= 8 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
}

/** Throws rather than publishing a feed that has obviously gone wrong upstream. */
export function assertPlausibleUpdate({ season, previousWeekly, nextWeekly }) {
  if (!previousWeekly.length) return;

  const lastWeek = (rows) => Math.max(...rows.map((row) => row.week));
  if (lastWeek(nextWeekly) < lastWeek(previousWeekly)) {
    throw new Error(
      `Refusing update: ${season} went from week ${lastWeek(previousWeekly)} to week ${lastWeek(nextWeekly)}`
    );
  }
  if (nextWeekly.length < previousWeekly.length * 0.9) {
    throw new Error(
      `Refusing update: ${season} shrank from ${previousWeekly.length} to ${nextWeekly.length} weekly rows`
    );
  }
}
