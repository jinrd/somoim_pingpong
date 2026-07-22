export type PublicLineupStatus = "draft" | "confirmed";

export type PublicTeamMatchStatus =
  | "scheduled"
  | "ready"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface PublicLineupTeam {
  id: string;
  name: string;
}

export interface PublicParticipantMatch {
  id: string;
  round: number;
  sortOrder: number;
  status: PublicTeamMatchStatus;

  isHomeTeam: boolean;

  opponentTeam: PublicLineupTeam;

  ownLineupStatus: PublicLineupStatus;
  opponentLineupStatus: PublicLineupStatus;
}

export interface PublicParticipantMatchesResponse {
  eventId: string;
  team: PublicLineupTeam | null;
  matches: PublicParticipantMatch[];
}

export interface PublicLineupMember {
  participantId: string;
  displayName: string;
  rankSnapshot: number;
  participantType: "member" | "guest";
  isRequester: boolean;
}

export interface PublicLineupGame {
  id: string;
  sequence: number;
  matchType: "singles" | "doubles";
  bestOf: number;
  requiredPlayerCount: number;

  status: "scheduled" | "in_progress" | "completed" | "cancelled";
}

export interface PublicLineupPlayer {
  matchGameId: string;
  participantId: string;
  position: number;
}

export interface PublicLineupContext {
  eventId: string;

  match: {
    id: string;
    round: number;
    sortOrder: number;
    status: PublicTeamMatchStatus;
  };

  team: PublicLineupTeam;
  opponentTeam: PublicLineupTeam;

  requester: {
    participantId: string;
    displayName: string;
  };

  members: PublicLineupMember[];
  games: PublicLineupGame[];

  lineup: {
    id: string;
    status: PublicLineupStatus;
    version: number;
    confirmedAt: string;

    confirmedBy: {
      participantId: string;
      displayName: string;
    } | null;

    players: PublicLineupPlayer[];
  };
}

export interface SavePublicLineupInput {
  responseToken: string;
  expectedVersion: number;
  status: PublicLineupStatus;

  games: Array<{
    matchGameId: string;
    participantIds: string[];
  }>;
}
