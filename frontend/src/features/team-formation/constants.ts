import type { TeamFormationMethod } from "./types";

export const TEAM_FORMATION_METHOD_LABELS: Record<TeamFormationMethod, string> =
  {
    balanced: "부수 균형 편성",
    random: "무작위 편성",
  };

/**
 * 팀 리그가 성립하기 위한 기본 팀 수입니다.
 * 참가자가 한 명뿐이면 실제 결과는 한 팀만 반환됩니다.
 */
export const MINIMUM_TEAM_COUNT = 2;

/**
 * 팀 간 교환 최적화가 과도하게 반복되는 것을 방지합니다.
 */
export const MAXIMUM_BALANCE_OPTIMIZATION_PASSES = 100;

/**
 * 부동소수점 비교 오차를 방지합니다.
 */
export const BALANCE_IMPROVEMENT_EPSILON = 0.0001;

export const TEAM_QUALITY_MAX_SCORE = 100;

export const TEAM_QUALITY_RANK_DIFFERENCE_PENALTY = 15;

export const TEAM_QUALITY_MEMBER_DIFFERENCE_PENALTY = 10;

export const ACCEPTABLE_AVERAGE_RANK_DIFFERENCE = 1;
