import type { MatchResultStatus, TeamMatchStatus } from "../match-schedule/api";

export type ResultTargetType = "team_game" | "individual_match";

export interface MonitorPlayerOption {
  participantId: string;
  name: string;
}

export interface MonitorResult {
  id: string;
  type: ResultTargetType;
  title: string;
  homeName: string;
  awayName: string;
  bestOf: number;
  version: number;
  status: TeamMatchStatus;
  resultStatus: MatchResultStatus;
  homeScore: number;
  awayScore: number;
  submissionCount: number;
  requiredPlayerCount: number;
  homePlayerOptions: MonitorPlayerOption[];
  awayPlayerOptions: MonitorPlayerOption[];
  homePlayerIds: string[];
  awayPlayerIds: string[];
}

export interface MonitorMatch {
  id: string;
  round: number;
  sortOrder: number;
  status: TeamMatchStatus;
  version: number;
  title: string;
  description: string;
  canCancelResult: boolean;
  results: MonitorResult[];
  hasDisputedResult: boolean;
}

export interface CancelTarget {
  id: string;
  type: ResultTargetType;
  title: string;
  version: number;
}

export type MonitorFilter = "all" | "waiting" | "in_progress" | "completed";
