import type { ColumnDef } from '@tanstack/react-table';
import type { PlayerSeasonWithPoints, PositionFilter } from '../types';

// Rank column - displays the player's fantasy points rank (sortable)
const rankColumn: ColumnDef<PlayerSeasonWithPoints> = {
  accessorKey: 'rank',
  header: '#',
  size: 40,
  cell: ({ getValue }) => (
    <span className="text-gray-500">{getValue<number>()}</span>
  ),
};

// Base columns shown for all positions
const baseColumns: ColumnDef<PlayerSeasonWithPoints>[] = [
  {
    accessorKey: 'year',
    header: 'Year',
    size: 60,
  },
  {
    accessorKey: 'player',
    header: 'Player',
    size: 150,
  },
  {
    accessorKey: 'team',
    header: 'Team',
    size: 60,
  },
  {
    accessorKey: 'fantasyPoints',
    header: 'Fantasy Pts',
    size: 100,
    cell: ({ getValue }) => (
      <span className="font-bold">{getValue<number>().toFixed(1)}</span>
    ),
  },
  {
    accessorKey: 'games',
    header: 'G',
    size: 40,
  },
];

// Replaces the Year and G columns when a single week is shown
const weeklyColumns: ColumnDef<PlayerSeasonWithPoints>[] = [
  { accessorKey: 'week', header: 'Week', size: 50 },
  ...baseColumns.filter((column) => column.header !== 'Year' && column.header !== 'G'),
  { accessorKey: 'opponent', header: 'Opp', size: 60 },
];

// Passing columns
const passingColumns: ColumnDef<PlayerSeasonWithPoints>[] = [
  { accessorKey: 'passCmp', header: 'Cmp', size: 50 },
  { accessorKey: 'passAtt', header: 'Att', size: 50 },
  { accessorKey: 'passYds', header: 'Pass Yds', size: 80 },
  { accessorKey: 'passTD', header: 'Pass TD', size: 65 },
  { accessorKey: 'passInt', header: 'Int', size: 40 },
];

// Rushing columns
const rushingColumns: ColumnDef<PlayerSeasonWithPoints>[] = [
  { accessorKey: 'rushAtt', header: 'Rush Att', size: 70 },
  { accessorKey: 'rushYds', header: 'Rush Yds', size: 80 },
  { accessorKey: 'rushTD', header: 'Rush TD', size: 65 },
];

// Receiving columns
const receivingColumns: ColumnDef<PlayerSeasonWithPoints>[] = [
  { accessorKey: 'recTgt', header: 'Tgt', size: 50 },
  { accessorKey: 'rec', header: 'Rec', size: 50 },
  { accessorKey: 'recYds', header: 'Rec Yds', size: 80 },
  { accessorKey: 'recTD', header: 'Rec TD', size: 65 },
];

// Fumble columns
const fumbleColumns: ColumnDef<PlayerSeasonWithPoints>[] = [
  { accessorKey: 'fmbLost', header: 'Fum Lost', size: 70 },
];

export function getColumnsForPosition(
  position: PositionFilter,
  showWeek = false
): ColumnDef<PlayerSeasonWithPoints>[] {
  const identityColumns = showWeek ? weeklyColumns : baseColumns;

  switch (position) {
    case 'QB':
      // QB: passing first, then rushing, then receiving at the end
      return [
        rankColumn,
        ...identityColumns,
        ...passingColumns,
        ...rushingColumns,
        ...receivingColumns,
        ...fumbleColumns,
      ];
    case 'RB':
      // RB: rushing first, then receiving, then passing at the end
      return [
        rankColumn,
        ...identityColumns,
        ...rushingColumns,
        ...receivingColumns,
        ...passingColumns,
        ...fumbleColumns,
      ];
    case 'WR':
    case 'TE':
      // WR/TE: receiving first, then rushing, then passing at the end
      return [
        rankColumn,
        ...identityColumns,
        ...receivingColumns,
        ...rushingColumns,
        ...passingColumns,
        ...fumbleColumns,
      ];
    case 'All':
    default:
      return [
        rankColumn,
        ...identityColumns,
        ...passingColumns,
        ...rushingColumns,
        ...receivingColumns,
        ...fumbleColumns,
      ];
  }
}
