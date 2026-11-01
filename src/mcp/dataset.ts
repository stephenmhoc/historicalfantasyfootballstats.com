import type { PlayerSeason, Position } from '../types';
import columns from './columns.json';

export interface PackedLookup {
  columns: string[];
  positions: Position[];
  players: string[];
  teams: string[];
  rows: number;
}

type Column = (typeof columns)[number];

const COLUMN = Object.fromEntries(columns.map((name, index) => [name, index])) as Record<Column, number>;
const WIDTH = columns.length;

export const SCORED_STATS = [
  'passYds', 'passTD', 'passInt', 'rushYds', 'rushTD', 'rushAtt', 'recYds', 'recTD', 'rec', 'fmbLost',
] as const;

export const COUNTING_STATS = [
  'games', 'passCmp', 'passAtt', 'passYds', 'passTD', 'passInt', 'rushAtt', 'rushYds', 'rushTD',
  'recTgt', 'rec', 'recYds', 'recTD', 'fmb', 'fmbLost',
] as const;

export interface DatasetRow extends Omit<PlayerSeason, 'week' | 'opponent'> {
  week: number | null;
  opponent: string | null;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Read-only view over the packed stats; values are decoded only for rows being returned. */
export class Dataset {
  readonly rowCount: number;
  private readonly data: Float32Array;
  private readonly lookup: PackedLookup;

  constructor(buffer: ArrayBuffer, lookup: PackedLookup) {
    if (lookup.columns.join() !== columns.join()) {
      throw new Error('Packed data was built with different columns');
    }
    this.data = new Float32Array(buffer);
    this.lookup = lookup;
    this.rowCount = this.data.length / WIDTH;
  }

  get(row: number, column: Column): number {
    return this.data[row * WIDTH + COLUMN[column]];
  }

  playerName(row: number): string {
    return this.lookup.players[this.get(row, 'player')];
  }

  positionOf(row: number): Position {
    return this.lookup.positions[this.get(row, 'position')];
  }

  /** Fractional values exist only as estimates in pre-1994 rows, at one decimal place. */
  decode(row: number): DatasetRow {
    const started = this.get(row, 'gamesStarted');
    const opponent = this.get(row, 'opponent');
    const week = this.get(row, 'week');

    const decoded = {
      player: this.playerName(row),
      team: this.lookup.teams[this.get(row, 'team')],
      position: this.positionOf(row),
      year: this.get(row, 'year'),
      week: week === 0 ? null : week,
      opponent: opponent < 0 ? null : this.lookup.teams[opponent],
      age: this.get(row, 'age'),
      gamesStarted: started < 0 ? null : started,
    } as DatasetRow;

    for (const stat of COUNTING_STATS) decoded[stat] = round1(this.get(row, stat));
    return decoded;
  }
}
