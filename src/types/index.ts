export type Position = 'QB' | 'RB' | 'WR' | 'TE';

export type PositionFilter = Position | 'All';

export type YearFilter =
  | 'AllYears'
  | 'Last56'
  | 'Last55'
  | 'Last36'
  | 'Last35'
  | '2020s'
  | '2010s'
  | '2000s'
  | '1990s'
  | '1980s'
  | '1970s'
  | number; // Individual year

export interface PlayerSeason {
  player: string;
  team: string;
  position: Position;
  age: number;
  games: number;
  gamesStarted: number;
  year: number;

  // Passing
  passCmp: number;
  passAtt: number;
  passYds: number;
  passTD: number;
  passInt: number;

  // Rushing
  rushAtt: number;
  rushYds: number;
  rushTD: number;

  // Receiving
  recTgt: number;
  rec: number;
  recYds: number;
  recTD: number;

  // Fumbles
  fmb: number;
  fmbLost: number;
}

export interface PlayerSeasonWithPoints extends PlayerSeason {
  fantasyPoints: number;
  rank: number;
}

export interface ScoringConfig {
  passingYardsPerPoint: number;
  passingTD: number;
  interception: number;
  rushingYardsPerPoint: number;
  rushingTD: number;
  rushingCarry: number;
  receivingYardsPerPoint: number;
  receivingTD: number;
  reception: number;
  fumbleLost: number;
}
