export type MatchResultTargetType = "team_game" | "individual_match";

export type MatchResultStatus = "pending" | "disputed" | "confirmed";

export type MatchResultSide = "home" | "away";

export type MatchResultTargetStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface MatchResultPlayer {
  participantId: string;
  name: string;
  position: number;
}

export interface MatchResultSideInfo {
  id: string;
  label: string;
  players: MatchResultPlayer[];
  members?: MatchResultPlayer[];
}

export interface OwnResultSubmission {
  id: string;
  homeScore: number;
  awayScore: number;
  version: number;
  updated: string;
}

export interface ConfirmedMatchResult {
  homeScore: number;
  awayScore: number;
  winnerSide: MatchResultSide;
  confirmedAt: string;
}

export interface PublicMatchResultContext {
  targetType: MatchResultTargetType;
  targetId: string;

  status: MatchResultTargetStatus;
  resultStatus: MatchResultStatus;

  bestOf: number;
  requiredWins: number;
  requiredPlayerCount: number;

  side: MatchResultSide;

  home: MatchResultSideInfo;
  away: MatchResultSideInfo;

  ownSubmission: OwnResultSubmission | null;
  otherSideSubmitted: boolean;

  result: ConfirmedMatchResult | null;
}

export interface SubmitMatchResultInput {
  requestId: string;
  responseToken: string;
  expectedVersion: number;
  homeScore: number;
  awayScore: number;
  participantIds?: string[];
}
