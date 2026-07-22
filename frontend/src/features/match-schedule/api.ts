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

export interface StoredMatchGame extends TeamScheduleFormat {
  id: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
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
    },
  );
};
