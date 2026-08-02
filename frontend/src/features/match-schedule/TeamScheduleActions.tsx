import { Save, Shuffle, Trash2 } from "lucide-react";

import type { TeamScheduleContext } from "./api";
import type { RoundRobinSchedule } from "./generateRoundRobin";

import styles from "./SchedulePanel.module.css";

interface Props {
  context: TeamScheduleContext;
  preview: RoundRobinSchedule | null;
  isSaving: boolean;
  onGenerate: () => void;
  onSave: () => void;
  onDelete: () => void;
}

export default function TeamScheduleActions({
  context,
  preview,
  isSaving,
  onGenerate,
  onSave,
  onDelete,
}: Props) {
  const canGenerate = context.totalMatchCount === 0 || context.canRegenerate;

  const canDelete =
    !preview && context.totalMatchCount > 0 && context.canRegenerate;

  return (
    <div className={styles.actions}>
      {canGenerate && (
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={isSaving}
          onClick={onGenerate}
        >
          <Shuffle size={17} aria-hidden="true" />

          {context.totalMatchCount > 0
            ? "경기 순서 새로 구성"
            : "대진 미리보기"}
        </button>
      )}

      {preview && (
        <button
          type="button"
          className={styles.primaryButton}
          disabled={isSaving}
          onClick={onSave}
        >
          <Save size={17} aria-hidden="true" />
          {isSaving ? "저장 중…" : "이 대진으로 저장"}
        </button>
      )}

      {canDelete && (
        <button
          type="button"
          className={styles.dangerButton}
          disabled={isSaving}
          onClick={onDelete}
        >
          <Trash2 size={17} aria-hidden="true" />
          대진표 삭제
        </button>
      )}
    </div>
  );
}
