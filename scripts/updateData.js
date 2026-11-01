// Refreshes one season from nflverse: weekly rows, season totals and site metadata.
// Usage: node scripts/updateData.js [--season 2026] [--force] [--cache-dir dir]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseArgs } from 'util';
import Papa from 'papaparse';
import {
  REQUIRED_WEEKLY_COLUMNS,
  assertPlausibleUpdate,
  currentSeason,
  transformSeason,
} from './lib/nflverse.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_FILE = path.join(ROOT, 'public', 'data', 'fantasy_data.json');
const WEEKLY_DIR = path.join(ROOT, 'public', 'data', 'weekly');
const META_FILE = path.join(ROOT, 'src', 'generated', 'dataMeta.json');

const RELEASES = 'https://github.com/nflverse/nflverse-data/releases/download';
const SCHEDULE_URL = 'https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv';
const USER_AGENT = 'historicalfantasyfootballstats.com data update';

const { values: args } = parseArgs({
  options: {
    season: { type: 'string' },
    force: { type: 'boolean', default: false },
    'cache-dir': { type: 'string' },
  },
});

async function fetchCsv(url, { optional = false } = {}) {
  const cacheFile = args['cache-dir'] && path.join(args['cache-dir'], path.basename(url));
  if (cacheFile && fs.existsSync(cacheFile)) return parseCsv(fs.readFileSync(cacheFile, 'utf8'));

  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (response.status === 404 && optional) return null;
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);

  const text = await response.text();
  if (cacheFile) fs.writeFileSync(cacheFile, text);
  return parseCsv(text);
}

function parseCsv(text) {
  const { data, errors } = Papa.parse(text, { header: true, skipEmptyLines: 'greedy' });
  const fatal = errors.find((error) => error.type !== 'FieldMismatch');
  if (fatal) throw new Error(`CSV parse error on row ${fatal.row}: ${fatal.message}`);
  return data;
}

function readJson(file, fallback) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
}

function writeAtomic(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, contents);
  fs.renameSync(temp, file);
}

function sameRows(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function main() {
  const season = Number(args.season ?? currentSeason());
  if (!Number.isInteger(season)) throw new Error(`Invalid season: ${args.season}`);

  const weeklyFile = path.join(WEEKLY_DIR, `${season}.json`);
  const existingRows = readJson(DATA_FILE);
  const previousSeasonRows = existingRows.filter((row) => row.year === season);
  const previousWeekly = readJson(weeklyFile, []);

  // Seasons without a weekly file came from the PFR exports, which include games
  // started. Replacing them would silently lose that, so it has to be deliberate.
  if (previousSeasonRows.length > 0 && previousWeekly.length === 0 && !args.force) {
    throw new Error(`${season} has PFR-sourced rows; pass --force to replace them with nflverse data`);
  }

  const weeklyRows = await fetchCsv(`${RELEASES}/stats_player/stats_player_week_${season}.csv`, {
    optional: true,
  });
  const hasRegularSeason = weeklyRows?.some((row) => row.season_type === 'REG');
  if (!hasRegularSeason) {
    console.log(`No ${season} regular-season stats published yet; nothing to do.`);
    return;
  }

  const missing = REQUIRED_WEEKLY_COLUMNS.filter((column) => !(column in weeklyRows[0]));
  if (missing.length > 0) throw new Error(`nflverse schema changed; missing: ${missing.join(', ')}`);

  const [players, snapRows, schedule] = await Promise.all([
    fetchCsv(`${RELEASES}/players/players.csv`),
    fetchCsv(`${RELEASES}/snap_counts/snap_counts_${season}.csv`, { optional: true }),
    fetchCsv(SCHEDULE_URL, { optional: true }),
  ]);

  const { weekly, seasonRows, weeks } = transformSeason({
    season,
    weeklyRows,
    players,
    snapRows: snapRows ?? [],
    existingRows,
    schedule: schedule ?? [],
  });

  if (weekly.length === 0) throw new Error(`nflverse ${season} produced no skill-position rows`);
  assertPlausibleUpdate({ season, previousWeekly, nextWeekly: weekly });

  const meta = readJson(META_FILE, { startYear: 1970, endYear: season, weeklySeasons: {} });
  const nextMeta = {
    ...meta,
    endYear: Math.max(meta.endYear, season),
    weeklySeasons: { ...meta.weeklySeasons, [season]: weeks },
  };
  const statsChanged = !sameRows(previousWeekly, weekly) || !sameRows(previousSeasonRows, seasonRows);

  if (!statsChanged && sameRows(meta, nextMeta)) {
    console.log(`${season} is already up to date.`);
    return;
  }

  if (statsChanged) nextMeta.updatedAt = new Date().toISOString();

  // Newest season first, matching the order the historical file already uses.
  const merged = [
    ...existingRows.filter((row) => row.year > season),
    ...seasonRows,
    ...existingRows.filter((row) => row.year < season),
  ];

  writeAtomic(weeklyFile, JSON.stringify(weekly));
  writeAtomic(DATA_FILE, JSON.stringify(merged));
  writeAtomic(META_FILE, `${JSON.stringify(nextMeta, null, 2)}\n`);

  const latest = weeks.at(-1);
  console.log(
    `${season}: ${seasonRows.length} players, ${weekly.length} weekly rows, through week ${latest.week} ` +
      `(${latest.gamesPlayed}/${latest.gamesScheduled ?? '?'} games)`
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
