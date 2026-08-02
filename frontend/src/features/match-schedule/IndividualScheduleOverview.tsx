import type { IndividualScheduleContext } from "./api";
import type { RoundRobinSchedule } from "./generateRoundRobin";

import styles from "./SchedulePanel.module.css";

interface Props {
  context: IndividualScheduleContext;
  preview: RoundRobinSchedule | null;
}

export default function IndividualScheduleOverview({
  context,
  preview,
}: Props) {
  return (
    <div className={styles.summary}>
      <div>
        <span>참가자</span>
        <strong>{context.participants.length}명</strong>
      </div>

      <div>
        <span>라운드</span>
        <strong>{preview?.totalRoundCount ?? context.totalRoundCount}</strong>
      </div>

      <div>
        <span>단식 대진</span>
        <strong>
          {preview?.totalMatchCount ?? context.totalMatchCount}경기
        </strong>
      </div>

      <div>
        <span>테이블</span>
        <strong>{context.tableCount}개</strong>
      </div>
    </div>
  );
}
