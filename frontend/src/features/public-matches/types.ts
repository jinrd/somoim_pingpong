export interface PublicTeam {
  id: string;
  name: string;
  sortOrder: number;
}

export interface PublicTeamMember {
  participantId: string;
  displayName: string;
  rankSnapshot: number;
  isRequester: boolean;
}

export interface PublicTeamMatchGame {
  id: string;
  sequence: number;
  matchType: "singles" | "doubles";
  bestOf: number;
  requiredPlayerCount: number;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
}
export type PublicTeamMatchStatus =
  | "scheduled"
  | "ready"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface PublicParticipantMatch {
  id: string;
  round: number;
  sortOrder: number;
  status: PublicTeamMatchStatus;
  tableNumber?: number;

  isHomeTeam: boolean;

  opponentTeam: PublicTeam;
}

export interface PublicParticipantMatchesResponse {
  eventId: string;
  team: PublicTeam | null;
  members: PublicTeamMember[];
  operationStatus?: "not_started" | "in_progress" | "completed";
  tableCount?: number;
  matches: PublicParticipantMatch[];
}

export interface PublicTeamMatchContext {
  eventId: string;

  match: {
    id: string;
    round: number;
    sortOrder: number;
    status: PublicTeamMatchStatus;
  };

  team: PublicTeam;
  opponentTeam: PublicTeam;
  games: PublicTeamMatchGame[];
}
