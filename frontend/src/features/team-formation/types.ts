import type { RecordModel } from "pocketbase";

import type { ParticipantType } from "../events/types";

export type TeamFormationMethod = "balanced" | "random";

export type TeamFormationStatus = "draft" | "confirmed";

export interface TeamFormationRecord extends RecordModel {
  event: string;
  game_setting: string;

  method: TeamFormationMethod;
  status: TeamFormationStatus;

  quality_score: number;
  version: number;
}

export interface TeamRecord extends RecordModel {
  formation: string;
  event: string;

  name: string;
  sort_order: number;
  average_rank: number;

  version: number;
}

export interface TeamMemberRecord extends RecordModel {
  formation: string;
  event: string;
  team: string;
  participant: string;

  rank_snapshot: number;
  sort_order: number;
}

/**
 * 자동 편성과 화면에서 사용하는 참가자 정보입니다.
 */
export interface FormationParticipant {
  participantId: string;
  participantType: ParticipantType;

  displayName: string;
  rankSnapshot: number;
}

/**
 * 아직 DB에 저장되지 않은 팀원도 포함할 수 있는 화면용 타입입니다.
 */
export interface TeamMemberDraft extends FormationParticipant {
  key: string;
}

/**
 * 자동 편성 결과와 운영자 수정 화면에서 사용하는 팀입니다.
 */
export interface TeamDraft {
  key: string;
  id?: string;

  name: string;
  sortOrder: number;

  members: TeamMemberDraft[];
}

/**
 * 팀 편성 품질을 화면에 표시하기 위한 계산 결과입니다.
 */
export interface TeamQualityMetrics {
  qualityScore: number;

  minimumTeamSize: number;
  maximumTeamSize: number;
  memberCountDifference: number;

  minimumAverageRank: number;
  maximumAverageRank: number;
  averageRankDifference: number;
}

/**
 * 자동 편성 알고리즘의 전체 반환값입니다.
 */
export interface TeamFormationResult {
  teams: TeamDraft[];

  participantCount: number;
  teamCount: number;

  metrics: TeamQualityMetrics;
  warnings: string[];
}

/**
 * 전체 팀 편성을 서버에 저장할 때 사용하는 입력값입니다.
 */
export interface SaveTeamFormationInput {
  method: TeamFormationMethod;
  status: TeamFormationStatus;

  teams: Array<{
    id?: string;
    name: string;

    participantIds: string[];
  }>;
}

export interface GenerateTeamFormationOptions {
  participants: FormationParticipant[];
  targetTeamSize: number;
  method: TeamFormationMethod;

  /**
   * 무작위 편성 테스트에서 고정 난수를 주입하기 위해 사용합니다.
   */
  random?: () => number;
}
