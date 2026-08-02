import type { TeamScheduleContext } from "./api";
import type { RoundRobinSchedule } from "./generateRoundRobin";

import styles from "./SchedulePanel.module.css";

interface Props {
  context: TeamScheduleContext;
  preview: RoundRobinSchedule | null;
}

export default function TeamScheduleOverview({ context, preview }: Props) {
  return (
    <>
      <header className={styles.header}>
        <div>
          <h2>팀 풀리그 대진표</h2>
        </div>
      </header>

      <div className={styles.summary}>
        <div>
          <span>팀</span>
          <strong>{context.teams.length}팀</strong>
        </div>

        <div>
          <span>라운드</span>
          <strong>{preview?.totalRoundCount ?? context.totalRoundCount}</strong>
        </div>

        <div>
          <span>팀 대진</span>
          <strong>
            {preview?.totalMatchCount ?? context.totalMatchCount}경기
          </strong>
        </div>

        <div>
          <span>세부 경기</span>
          <strong>{context.formats.length}경기씩</strong>
        </div>
      </div>
    </>
  );
}
