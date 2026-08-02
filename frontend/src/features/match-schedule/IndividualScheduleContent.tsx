import { Loader2 } from "lucide-react";

import type { IndividualScheduleContext } from "./api";
import type { RoundRobinSchedule } from "./generateRoundRobin";
import {
  IndividualSchedulePreviewRounds,
  IndividualScheduleStoredRounds,
} from "./IndividualScheduleRounds";

import styles from "./SchedulePanel.module.css";

interface Props {
  context: IndividualScheduleContext | null;
  preview: RoundRobinSchedule | null;
  isLoading: boolean;
}

export default function IndividualScheduleContent({
  context,
  preview,
  isLoading,
}: Props) {
  if (isLoading) {
    return (
      <div className={styles.loadingState}>
        <Loader2 size={24} className={styles.spinner} aria-hidden="true" />
        <p>대진표를 불러오는 중입니다…</p>
      </div>
    );
  }

  if (preview) {
    return <IndividualSchedulePreviewRounds schedule={preview} />;
  }

  if (context && context.totalMatchCount > 0) {
    return <IndividualScheduleStoredRounds rounds={context.rounds} />;
  }

  return (
    <div className={styles.emptyState}>
      <p>아직 저장된 대진표가 없습니다.</p>
      <p>대진표 생성 버튼을 눌러 미리보기를 확인해 주세요.</p>
    </div>
  );
}
