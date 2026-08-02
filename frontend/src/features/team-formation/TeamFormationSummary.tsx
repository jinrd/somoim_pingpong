import { Users } from "lucide-react";

import type { TeamQualityMetrics } from "./types";

import styles from "./TeamFormationPanel.module.css";

interface Props {
  participantCount: number;
  teamCount: number;
  metrics: TeamQualityMetrics;
}

export default function TeamFormationSummary({
  participantCount,
  teamCount,
  metrics,
}: Props) {
  return (
    <div className={styles.summaryGrid}>
      <div>
        <Users size={20} aria-hidden="true" />
        <span>게임 참가자</span>
        <strong>{participantCount}명</strong>
      </div>

      <div>
        <span>팀 수</span>
        <strong>{teamCount}팀</strong>
      </div>

      <div>
        <span>품질 점수</span>
        <strong>{metrics.qualityScore}점</strong>
      </div>

      <div>
        <span>평균 부수 차이</span>
        <strong>{metrics.averageRankDifference}</strong>
      </div>
    </div>
  );
}
