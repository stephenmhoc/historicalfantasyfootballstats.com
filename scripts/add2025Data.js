import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { fileURLToPath } from 'url';
import { hasPlayed, roughFantasyPoints } from './lib/nflverse.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const YEAR = 2025;
const INPUT_FILE = path.join(__dirname, '..', 'fantasy-2025.csv');
const DATA_FILE = path.join(__dirname, '..', 'public', 'data', 'fantasy_data.json');
const POSITIONS = new Set(['QB', 'RB', 'WR', 'TE']);

const OUTPUT_FIELDS = [
  'player',
  'team',
  'position',
  'age',
  'games',
  'gamesStarted',
  'year',
  'passCmp',
  'passAtt',
  'passYds',
  'passTD',
  'passInt',
  'rushAtt',
  'rushYds',
  'rushTD',
  'recTgt',
  'rec',
  'recYds',
  'recTD',
  'fmb',
  'fmbLost',
];

// The 2025 export has repeated column labels, so map by known column position.
const COLUMNS = {
  player: 1,
  team: 2,
  position: 3,
  age: 4,
  games: 5,
  gamesStarted: 6,
  passCmp: 7,
  passAtt: 8,
  passYds: 9,
  passTD: 10,
  passInt: 11,
  rushAtt: 12,
  rushYds: 13,
  rushTD: 15,
  recTgt: 16,
  rec: 17,
  recYds: 18,
  recTD: 20,
  fmb: 21,
  fmbLost: 22,
};

function parseCsv() {
  const csv = fs.readFileSync(INPUT_FILE, 'utf8');
  const result = Papa.parse(csv, {
    skipEmptyLines: 'greedy',
  });

  if (result.errors.length > 0) {
    const firstError = result.errors[0];
    throw new Error(`CSV parse error on row ${firstError.row}: ${firstError.message}`);
  }

  if (result.data.length < 3) {
    throw new Error('CSV does not include the expected category row, header row, and data rows');
  }

  const [categoryHeader, fieldHeader, ...rows] = result.data;
  validateHeaders(categoryHeader, fieldHeader);
  return rows;
}

function validateHeaders(categoryHeader, fieldHeader) {
  const checks = [
    [COLUMNS.player, fieldHeader, 'Player'],
    [COLUMNS.team, fieldHeader, 'Tm'],
    [COLUMNS.position, fieldHeader, 'FantPos'],
    [COLUMNS.passCmp, categoryHeader, 'Passing'],
    [COLUMNS.passAtt, categoryHeader, 'Passing'],
    [COLUMNS.rushAtt, categoryHeader, 'Rushing'],
    [COLUMNS.rushYds, categoryHeader, 'Rushing'],
    [COLUMNS.recTgt, categoryHeader, 'Receiving'],
    [COLUMNS.recYds, categoryHeader, 'Receiving'],
    [COLUMNS.fmbLost, categoryHeader, 'Fumbles'],
  ];

  for (const [index, header, expected] of checks) {
    if (header[index] !== expected) {
      throw new Error(
        `Unexpected CSV format at column ${index + 1}: expected "${expected}", found "${
          header[index] ?? ''
        }"`
      );
    }
  }
}

function cleanRows(rows) {
  return rows
    .map((row, index) => cleanRow(row, index + 3))
    .filter(Boolean)
    .filter(hasPlayed)
    .sort((a, b) => roughFantasyPoints(b) - roughFantasyPoints(a));
}

function cleanRow(row, lineNumber) {
  const position = text(row[COLUMNS.position]);

  if (!POSITIONS.has(position)) {
    return null;
  }

  const cleaned = {
    player: cleanPlayerName(row[COLUMNS.player]),
    team: text(row[COLUMNS.team]),
    position,
    age: number(row[COLUMNS.age], 'age', lineNumber),
    games: number(row[COLUMNS.games], 'games', lineNumber),
    gamesStarted: number(row[COLUMNS.gamesStarted], 'gamesStarted', lineNumber),
    year: YEAR,
    passCmp: number(row[COLUMNS.passCmp], 'passCmp', lineNumber),
    passAtt: number(row[COLUMNS.passAtt], 'passAtt', lineNumber),
    passYds: number(row[COLUMNS.passYds], 'passYds', lineNumber),
    passTD: number(row[COLUMNS.passTD], 'passTD', lineNumber),
    passInt: number(row[COLUMNS.passInt], 'passInt', lineNumber),
    rushAtt: number(row[COLUMNS.rushAtt], 'rushAtt', lineNumber),
    rushYds: number(row[COLUMNS.rushYds], 'rushYds', lineNumber),
    rushTD: number(row[COLUMNS.rushTD], 'rushTD', lineNumber),
    recTgt: number(row[COLUMNS.recTgt], 'recTgt', lineNumber),
    rec: number(row[COLUMNS.rec], 'rec', lineNumber),
    recYds: number(row[COLUMNS.recYds], 'recYds', lineNumber),
    recTD: number(row[COLUMNS.recTD], 'recTD', lineNumber),
    fmb: number(row[COLUMNS.fmb], 'fmb', lineNumber),
    fmbLost: number(row[COLUMNS.fmbLost], 'fmbLost', lineNumber),
  };

  for (const field of ['player', 'team', 'position']) {
    if (!cleaned[field]) {
      throw new Error(`Missing ${field} on CSV line ${lineNumber}`);
    }
  }

  return orderFields(cleaned);
}

function orderFields(row) {
  return OUTPUT_FIELDS.reduce((ordered, field) => {
    ordered[field] = row[field];
    return ordered;
  }, {});
}

function cleanPlayerName(value) {
  return text(value).replace(/[+*]+$/g, '').trim();
}

function text(value) {
  return String(value ?? '').trim();
}

function number(value, field, lineNumber) {
  const raw = text(value);

  if (raw === '') {
    return 0;
  }

  const parsed = Number(raw);

  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid number for ${field} on CSV line ${lineNumber}: "${raw}"`);
  }

  return Number.isInteger(parsed) ? parsed : Math.round(parsed * 10) / 10;
}

function loadExistingData() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

  if (!Array.isArray(data)) {
    throw new Error(`${DATA_FILE} must contain a JSON array`);
  }

  return data;
}

function writeData(existingData, newRows) {
  if (newRows.length === 0) {
    throw new Error(`No ${YEAR} rows found; leaving ${DATA_FILE} unchanged`);
  }

  const existing2025Rows = existingData.filter((row) => row.year === YEAR);
  const retainedRows = existingData.filter((row) => row.year !== YEAR);
  const merged = JSON.stringify([...newRows, ...retainedRows]);

  // Verify a temp file first, so a failed write can never damage the only copy.
  const tempFile = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tempFile, merged);

  const writtenData = JSON.parse(fs.readFileSync(tempFile, 'utf8'));
  const retainedAfter = writtenData.filter((row) => row.year !== YEAR);

  if (JSON.stringify(retainedAfter) !== JSON.stringify(retainedRows)) {
    fs.rmSync(tempFile);
    throw new Error(`Safety check failed: non-${YEAR} data changed`);
  }

  fs.renameSync(tempFile, DATA_FILE);

  return {
    addedRows: newRows.length,
    replacedRows: existing2025Rows.length,
    totalRows: writtenData.length,
  };
}

function yearRange(rows) {
  const years = rows.map((row) => row.year);
  return `${Math.min(...years)}-${Math.max(...years)}`;
}

function main() {
  const csvRows = parseCsv();
  const newRows = cleanRows(csvRows);
  const existingData = loadExistingData();
  const result = writeData(existingData, newRows);
  const updatedData = loadExistingData();

  console.log(`Read ${csvRows.length} CSV data rows from ${path.basename(INPUT_FILE)}`);
  console.log(`Cleaned ${result.addedRows} ${YEAR} QB/RB/WR/TE rows`);

  if (result.replacedRows > 0) {
    console.log(`Replaced ${result.replacedRows} existing ${YEAR} rows`);
  }

  console.log(`Wrote ${result.totalRows} total rows to ${DATA_FILE}`);
  console.log(`Year range: ${yearRange(updatedData)}`);
  console.log(`Verified non-${YEAR} rows were unchanged`);
}

main();
