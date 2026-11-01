// Packs season and weekly rows into a columnar binary for the MCP function.
// Cloudflare's free tier allows 10ms of CPU per request, which parsing the 8MB JSON
// would exceed. A Float32Array needs no parsing, so every query, including all-time
// leaders under custom scoring, fits. Output is derived, so it is gitignored.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'public', 'data');
const OUTPUT_DIR = path.join(DATA_DIR, 'mcp');
const COLUMNS = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'mcp', 'columns.json'), 'utf8'));

const POSITIONS = ['QB', 'RB', 'WR', 'TE'];

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

function intern(table, index, value) {
  if (!index.has(value)) {
    index.set(value, table.length);
    table.push(value);
  }
  return index.get(value);
}

export function packRows(rows) {
  const players = [];
  const teams = [];
  const playerIndex = new Map();
  const teamIndex = new Map();
  const buffer = new Float32Array(rows.length * COLUMNS.length);

  rows.forEach((row, rowIndex) => {
    const encoded = {
      ...row,
      player: intern(players, playerIndex, row.player),
      team: intern(teams, teamIndex, row.team),
      opponent: row.opponent ? intern(teams, teamIndex, row.opponent) : -1,
      position: POSITIONS.indexOf(row.position),
      week: row.week ?? 0,
      gamesStarted: row.gamesStarted ?? -1,
    };

    COLUMNS.forEach((column, columnIndex) => {
      const value = encoded[column];
      if (!Number.isFinite(value) || (column === 'position' && value < 0)) {
        throw new Error(`Cannot pack ${column}=${row[column]} for ${row.player} ${row.year}`);
      }
      buffer[rowIndex * COLUMNS.length + columnIndex] = value;
    });
  });

  return { buffer, lookup: { columns: COLUMNS, positions: POSITIONS, players, teams, rows: rows.length } };
}

function main() {
  const seasons = readJson(path.join(DATA_DIR, 'fantasy_data.json'));
  const weeklyDir = path.join(DATA_DIR, 'weekly');
  const weekly = fs
    .readdirSync(weeklyDir)
    .filter((file) => file.endsWith('.json'))
    .flatMap((file) => readJson(path.join(weeklyDir, file)));

  const { buffer, lookup } = packRows([...seasons, ...weekly]);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, 'stats.bin'), Buffer.from(buffer.buffer));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'lookup.json'), JSON.stringify(lookup));
  console.log(`Packed ${lookup.rows} rows (${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
