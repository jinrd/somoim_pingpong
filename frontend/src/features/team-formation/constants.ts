import type { TeamFormationMethod, TeamFormationStatus } from "./types";

export const TEAM_FORMATION_METHOD_LABELS: Record<TeamFormationMethod, string> =
  {
    balanced: "부수 균형 편성",
    random: "무작위 편성",
  };

export const TEAM_FORMATION_STATUS_LABELS: Record<TeamFormationStatus, string> =
  {
    draft: "편성 중",
    confirmed: "편성 확정",
  };
