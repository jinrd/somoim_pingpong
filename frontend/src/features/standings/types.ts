export type StandingsCompetitionType = "team_league" | "individual_singles";

export type StandingsResultStatus = "pending" | "disputed" | "confirmed";

export interface StandingsEntity {
  id: string;
  name: string;
  sortOrder: number;
}

export interface StandingsPlayer {
  participantId: string;
  name: string;
  position: number;
}

export interface StandingsGame {
  id: string;
  sequence: number;

  matchType: "singles" | "doubles";
  bestOf: number;

  status: string;
  resultStatus: StandingsResultStatus;

  homeScore: number;
  awayScore: number;

  winnerSide: "home" | "away" | "";

  submissionCount: number;

  homePlayers: StandingsPlayer[];
  awayPlayers: StandingsPlayer[];
}

export interface StandingsMatch {
  id: string;

  round: number;
  sortOrder: number;

  status: string;
  resultStatus: StandingsResultStatus;

  homeEntity: StandingsEntity;
  awayEntity: StandingsEntity;

  homeScore: number;
  awayScore: number;

  winnerEntityId: string;

  submissionCount?: number;

  bestOf?: number;

  games: StandingsGame[];
}

export interface StandingsRow {
  entityId: string;
  name: string;

  rank: number;

  played: number;
  wins: number;
  losses: number;
  points: number;
  headToHeadPoints: number;

  scoreFor: number;
  scoreAgainst: number;
  setRatio: number | null;
}

export interface StandingsResponse {
  competitionType: StandingsCompetitionType;

  entities: StandingsEntity[];
  matches: StandingsMatch[];
  standings: StandingsRow[];
}
