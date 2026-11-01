import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { fileURLToPath } from 'url';
import { hasPlayed, roughFantasyPoints } from './lib/nflverse.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_FILE = path.join(__dirname, '..', 'fantasy_data.csv');
const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'data', 'fantasy_data.json');

// Columns we care about (mapped to cleaner names)
const COLUMN_MAP = {
  'Player': 'player',
  'Tm': 'team',
  'Pos': 'position',
  'Age': 'age',
  'G': 'games',
  'GS': 'gamesStarted',
  'Year': 'year',
  'Pass_Cmp': 'passCmp',
  'Pass_Att': 'passAtt',
  'Pass_Yds': 'passYds',
  'Pass_TD': 'passTD',
  'Pass_Int': 'passInt',
  'Rush_Att': 'rushAtt',
  'Rush_Yds': 'rushYds',
  'Rush_TD': 'rushTD',
  'Rec_Tgt': 'recTgt',
  'Rec_Rec': 'rec',
  'Rec_Yds': 'recYds',
  'Rec_TD': 'recTD',
  'Fmb': 'fmb',
  'FmbLost': 'fmbLost',
};

function processData() {
  console.log('Reading CSV file...');
  const csvContent = fs.readFileSync(INPUT_FILE, 'utf8');

  console.log('Parsing CSV...');
  const result = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  console.log(`Parsed ${result.data.length} rows`);

  // Transform and filter the data
  const processed = result.data
    .filter(row => ['QB', 'RB', 'WR', 'TE'].includes(row.Pos))
    .map(row => {
      const cleaned = {};
      for (const [csvCol, jsonCol] of Object.entries(COLUMN_MAP)) {
        let value = row[csvCol];

        // Convert numeric fields
        if (jsonCol !== 'player' && jsonCol !== 'team' && jsonCol !== 'position') {
          value = parseFloat(value) || 0;
          // Round to avoid floating point issues
          if (!Number.isInteger(value)) {
            value = Math.round(value * 10) / 10;
          }
        }

        cleaned[jsonCol] = value;
      }
      return cleaned;
    })
    .filter(hasPlayed)
    // Sort by year descending, then by a rough fantasy point estimate
    .sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      return roughFantasyPoints(b) - roughFantasyPoints(a);
    });

  console.log(`Processed ${processed.length} player-seasons`);

  // Later seasons come from updateData.js and are not in the CSV, so keep them.
  if (fs.existsSync(OUTPUT_FILE)) {
    const lastCsvYear = Math.max(...processed.map((row) => row.year));
    const laterRows = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8')).filter((row) => row.year > lastCsvYear);
    processed.unshift(...laterRows);
    console.log(`Kept ${laterRows.length} rows from after ${lastCsvYear}`);
  }

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write JSON output
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(processed, null, 0));

  const stats = fs.statSync(OUTPUT_FILE);
  console.log(`Wrote ${OUTPUT_FILE} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

  // Show sample data
  console.log('\nSample data (first 3 rows):');
  console.log(JSON.stringify(processed.slice(0, 3), null, 2));

  // Show year range
  const years = [...new Set(processed.map(p => p.year))].sort();
  console.log(`\nYear range: ${years[0]} - ${years[years.length - 1]}`);
}

processData();
