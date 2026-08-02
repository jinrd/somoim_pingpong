import { pb } from "../../lib/pocketbase";

import type {
  RoundRobinSchedule,
  RoundRobinTeam,
  ScheduledTeamMatch,
} from "./generateRoundRobin";

export type TeamMatchStatus =
  | "scheduled"
  | "ready"
  | "in_progress"
  | "completed"
  | "cancelled";

export type LineupStatus = "draft" | "confirmed";
export type MatchResultStatus = "pending" | "disputed" | "confirmed";

export type MatchWinnerSide = "home" | "away" | "";

export interface StoredMatchPlayer {
  participantId: string;
  name: string;
  position: number;
}

export interface StoredMatchResult {
  resultStatus: MatchResultStatus;

  homeScore: number;
  awayScore: number;

  winnerSide: MatchWinnerSide;
  resultConfirmedAt: string;

  submissionCount: number;
}
export interface SaveTeamScheduleInput {
  /**
   * 대진을 생성할 때 사용한 팀 편성 버전입니다.
   */
  expectedFormationVersion: number;

  /**
   * 최초 저장은 0입니다.
   * 기존 대진을 다시 저장하면 서버에서 받은 버전을 사용합니다.
   */
  expectedScheduleVersion: number;

  schedule: RoundRobinSchedule;
}

export interface SaveTeamScheduleResult {
  formationId: string;

  scheduleVersion: number;

  totalRoundCount: number;
  totalMatchCount: number;
  matchFormatCount: number;
}

const validateMatch = (match: ScheduledTeamMatch, index: number): void => {
  if (!match.homeTeamId || !match.awayTeamId) {
    throw new Error(`${index + 1}번째 대진의 팀 정보가 없습니다.`);
  }

  if (match.homeTeamId === match.awayTeamId) {
    throw new Error("같은 팀끼리는 대결할 수 없습니다.");
  }

  if (!Number.isInteger(match.round) || match.round < 1) {
    throw new Error(`${index + 1}번째 대진의 라운드가 올바르지 않습니다.`);
  }

  if (!Number.isInteger(match.sortOrder) || match.sortOrder < 1) {
    throw new Error(`${index + 1}번째 대진 순서가 올바르지 않습니다.`);
  }
};

export const saveTeamSchedule = async (
  gameSettingId: string,
  input: SaveTeamScheduleInput,
): Promise<SaveTeamScheduleResult> => {
  if (!gameSettingId) {
    throw new Error("게임 설정 정보가 없습니다.");
  }

  if (
    !Number.isInteger(input.expectedFormationVersion) ||
    input.expectedFormationVersion < 1
  ) {
    throw new Error("팀 편성 버전 정보가 없습니다.");
  }

  if (
    !Number.isInteger(input.expectedScheduleVersion) ||
    input.expectedScheduleVersion < 0
  ) {
    throw new Error("대진표 버전 정보가 올바르지 않습니다.");
  }

  if (input.schedule.matches.length === 0) {
    throw new Error("저장할 대진이 없습니다.");
  }

  input.schedule.matches.forEach(validateMatch);

  return pb.send<SaveTeamScheduleResult>(
    `/api/somoim/admin/game-settings/${encodeURIComponent(
      gameSettingId,
    )}/team-schedule`,
    {
      method: "PUT",

      body: {
        expectedFormationVersion: input.expectedFormationVersion,

        expectedScheduleVersion: input.expectedScheduleVersion,

        matches: input.schedule.matches.map((match) => ({
          homeTeamId: match.homeTeamId,
          awayTeamId: match.awayTeamId,

          round: match.round,
          sortOrder: match.sortOrder,
        })),
      },
    },
  );
};

export interface TeamScheduleFormat {
  sequence: number;
  matchType: "singles" | "doubles";
  bestOf: number;
  countsForRanking: boolean;
}

export interface StoredMatchGame extends TeamScheduleFormat, StoredMatchResult {
  id: string;
  version: number;

  status: "scheduled" | "in_progress" | "completed" | "cancelled";

  homePlayers: StoredMatchPlayer[];
  awayPlayers: StoredMatchPlayer[];
}

export interface StoredTeamMatch {
  id: string;

  pairKey: string;

  round: number;
  sortOrder: number;

  status: TeamMatchStatus;
  version: number;

  homeTeam: RoundRobinTeam;
  awayTeam: RoundRobinTeam;
  homeMembers: StoredMatchPlayer[];
  awayMembers: StoredMatchPlayer[];

  games: StoredMatchGame[];

  homeLineupStatus: LineupStatus;
  awayLineupStatus: LineupStatus;
}

export interface StoredScheduleRound {
  round: number;
  matches: StoredTeamMatch[];
  byeTeam: RoundRobinTeam | null;
}

export interface TeamScheduleContext {
  eventId: string;
  gameSettingId: string;

  formation: {
    id: string;
    status: "draft" | "confirmed";
    version: number;
  } | null;

  teams: RoundRobinTeam[];
  formats: TeamScheduleFormat[];

  scheduleVersion: number;
  totalRoundCount: number;
  totalMatchCount: number;

  canRegenerate: boolean;
  rounds: StoredScheduleRound[];
}

export const getTeamSchedule = async (
  gameSettingId: string,
): Promise<TeamScheduleContext> => {
  return pb.send<TeamScheduleContext>(
    `/api/somoim/admin/game-settings/${encodeURIComponent(
      gameSettingId,
    )}/team-schedule`,
    {
      method: "GET",
      requestKey: null,
    },
  );
};

export interface SaveIndividualScheduleInput {
  expectedScheduleVersion: number;
  schedule: RoundRobinSchedule;
}
export interface SaveIndividualScheduleResult {
  scheduleVersion: number;
  totalRoundCount: number;
  totalMatchCount: number;
}

export const saveIndividualSchedule = async (
  gameSettingId: string,
  input: SaveIndividualScheduleInput,
): Promise<SaveIndividualScheduleResult> => {
  if (!gameSettingId) {
    throw new Error("게임 설정 정보가 없습니다.");
  }
  if (
    !Number.isInteger(input.expectedScheduleVersion) ||
    input.expectedScheduleVersion < 0
  ) {
    throw new Error("대진표 버전 정보가 올바르지 않습니다.");
  }
  if (input.schedule.matches.length === 0) {
    throw new Error("저장할 대진이 없습니다.");
  }

  input.schedule.matches.forEach(validateMatch);

  return pb.send<SaveIndividualScheduleResult>(
    `/api/somoim/admin/game-settings/${encodeURIComponent(gameSettingId)}/individual-schedule`,
    {
      method: "PUT",
      body: {
        expectedScheduleVersion: input.expectedScheduleVersion,
        matches: input.schedule.matches.map((match) => ({
          // 백엔드는 ParticipantId로 받지만, 프론트엔드의 공통 대진 생성기(generateRoundRobin)는
          // 일관되게 TeamId 속성명을 사용하므로 이를 매핑해줍니다.
          homeParticipantId: match.homeTeamId,
          awayParticipantId: match.awayTeamId,
          round: match.round,
          sortOrder: match.sortOrder,
        })),
      },
    },
  );
};

export const deleteSchedule = async (gameSettingId: string): Promise<void> => {
  if (!gameSettingId) {
    throw new Error("게임 설정 정보가 없습니다.");
  }

  return pb.send(
    `/api/somoim/admin/game-settings/${encodeURIComponent(gameSettingId)}/schedule`,
    {
      method: "DELETE",
    },
  );
};

export interface StoredIndividualMatch extends StoredMatchResult {
  id: string;
  pairKey: string;

  round: number;
  sortOrder: number;

  status: TeamMatchStatus;
  version: number;

  bestOf: number;
  countsForRanking: boolean;

  homeParticipant: RoundRobinTeam;
  awayParticipant: RoundRobinTeam;
  tableNumber: number;
}
export interface StoredIndividualScheduleRound {
  round: number;
  matches: StoredIndividualMatch[];
  byeParticipant: RoundRobinTeam | null;
}
export interface IndividualScheduleContext {
  eventId: string;
  gameSettingId: string;

  participants: RoundRobinTeam[];

  scheduleVersion: number;
  totalRoundCount: number;
  totalMatchCount: number;

  canRegenerate: boolean;
  rounds: StoredIndividualScheduleRound[];
  operationStatus: "not_started" | "in_progress" | "completed";
  tableCount: number;
}
export const getIndividualSchedule = async (
  gameSettingId: string,
): Promise<IndividualScheduleContext> => {
  return pb.send<IndividualScheduleContext>(
    `/api/somoim/admin/game-settings/${encodeURIComponent(
      gameSettingId,
    )}/individual-schedule`,
    {
      method: "GET",
      requestKey: null,
    },
  );
};

export interface CancelMatchResultInput {
  expectedVersion: number;
  reason: string;
}

export interface ConfirmMatchResultInput {
  expectedVersion: number;
  homeScore: number;
  awayScore: number;
  reason: string;
  homeParticipantIds?: string[];
  awayParticipantIds?: string[];
}

export interface ConfirmMatchResultResponse {
  id: string;
  status: TeamMatchStatus;
  resultStatus: MatchResultStatus;
  homeScore: number;
  awayScore: number;
  winnerSide: MatchWinnerSide;
  resultConfirmedAt: string;
  version: number;
}

export const confirmTeamGameResult = async (
  matchGameId: string,
  input: ConfirmMatchResultInput,
): Promise<ConfirmMatchResultResponse> => {
  return pb.send<ConfirmMatchResultResponse>(
    `/api/somoim/admin/match-games/${encodeURIComponent(
      matchGameId,
    )}/result/confirm`,
    {
      method: "POST",
      body: {
        requestId: crypto.randomUUID(),
        expectedVersion: input.expectedVersion,
        homeScore: input.homeScore,
        awayScore: input.awayScore,
        reason: input.reason,
        homeParticipantIds: input.homeParticipantIds || [],
        awayParticipantIds: input.awayParticipantIds || [],
      },
    },
  );
};

export const confirmIndividualMatchResult = async (
  matchId: string,
  input: ConfirmMatchResultInput,
): Promise<ConfirmMatchResultResponse> => {
  return pb.send<ConfirmMatchResultResponse>(
    `/api/somoim/admin/individual-matches/${encodeURIComponent(
      matchId,
    )}/result/confirm`,
    {
      method: "POST",
      body: {
        requestId: crypto.randomUUID(),
        expectedVersion: input.expectedVersion,
        homeScore: input.homeScore,
        awayScore: input.awayScore,
        reason: input.reason,
      },
    },
  );
};

export interface CancelMatchResultResponse {
  id: string;
  status: TeamMatchStatus;
  version: number;
}

export const cancelTeamGameResult = async (
  matchId: string,
  input: CancelMatchResultInput,
): Promise<CancelMatchResultResponse> => {
  return pb.send<CancelMatchResultResponse>(
    `/api/somoim/admin/match-games/${encodeURIComponent(
      matchId,
    )}/result/cancel`,
    {
      method: "POST",
      body: {
        requestId: crypto.randomUUID(),
        expectedVersion: input.expectedVersion,
        reason: input.reason,
      },
    },
  );
};

export const cancelIndividualMatchResult = async (
  matchId: string,
  input: CancelMatchResultInput,
): Promise<CancelMatchResultResponse> => {
  return pb.send<CancelMatchResultResponse>(
    `/api/somoim/admin/individual-matches/${encodeURIComponent(
      matchId,
    )}/result/cancel`,
    {
      method: "POST",
      body: {
        requestId: crypto.randomUUID(),
        expectedVersion: input.expectedVersion,
        reason: input.reason,
      },
    },
  );
};

export interface StartIndividualLeagueResult {
  operationStatus: "in_progress" | "completed";
  tableCount: number;

  assignedMatches: Array<{
    matchId: string;
    tableNumber: number;
  }>;
}

export const startIndividualLeague = async (
  gameSettingId: string,
): Promise<StartIndividualLeagueResult> => {
  if (!gameSettingId) {
    throw new Error("게임 설정 정보가 없습니다.");
  }

  return pb.send<StartIndividualLeagueResult>(
    `/api/somoim/admin/game-settings/${encodeURIComponent(
      gameSettingId,
    )}/individual-operation/start`,
    {
      method: "POST",
    },
  );
};
