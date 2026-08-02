import {
  CirclePlay,
  Loader2,
  RefreshCcw,
  Save,
  Trash2,
} from "lucide-react";

import type { IndividualScheduleContext } from "./api";

import styles from "./SchedulePanel.module.css";

interface Props {
  context: IndividualScheduleContext | null;
  hasPreview: boolean;
  isLoading: boolean;
  isSaving: boolean;
  isStarting: boolean;
  onGenerate: () => void;
  onSave: () => void;
  onDelete: () => void;
  onStart: () => void;
}

export default function IndividualScheduleActions({
  context,
  hasPreview,
  isLoading,
  isSaving,
  isStarting,
  onGenerate,
  onSave,
  onDelete,
  onStart,
}: Props) {
  const matches = context?.rounds.flatMap((round) => round.matches) ?? [];

  const inProgressMatchCount = matches.filter(
    (match) => match.status === "in_progress",
  ).length;

  const scheduledMatchCount = matches.filter(
    (match) => match.status === "scheduled",
  ).length;

  const canRecoverAssignment =
    context?.operationStatus === "in_progress" &&
    inProgressMatchCount === 0 &&
    scheduledMatchCount > 0;

  const canStart =
    context &&
    context.totalMatchCount > 0 &&
    (context.operationStatus === "not_started" || canRecoverAssignment) &&
    !hasPreview;

  const canGenerate =
    !context || context.totalMatchCount === 0 || context.canRegenerate;

  const canDelete =
    context &&
    context.totalMatchCount > 0 &&
    context.canRegenerate &&
    !hasPreview;

  return (
    <div className={styles.actions}>
      {canStart && (
        <button
          type="button"
          className={styles.primaryButton}
          disabled={isLoading || isSaving || isStarting}
          onClick={onStart}
        >
          {isStarting ? (
            <Loader2 size={16} className={styles.spinner} aria-hidden="true" />
          ) : (
            <CirclePlay size={16} aria-hidden="true" />
          )}

          {canRecoverAssignment ? "빈 테이블 경기 배정" : "단식 리그 시작"}
        </button>
      )}

      {canGenerate && (
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={isLoading || isSaving}
          onClick={onGenerate}
        >
          <RefreshCcw size={16} aria-hidden="true" />

          {context?.totalMatchCount === 0
            ? "대진표 최초 생성"
            : "대진표 재생성"}
        </button>
      )}

      {canDelete && (
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={isLoading || isSaving}
          onClick={onDelete}
        >
          <Trash2 size={16} aria-hidden="true" />
          대진표 삭제
        </button>
      )}

      {hasPreview && (
        <button
          type="button"
          className={styles.primaryButton}
          disabled={isLoading || isSaving}
          onClick={onSave}
        >
          {isSaving ? (
            <Loader2 size={16} className={styles.spinner} aria-hidden="true" />
          ) : (
            <Save size={16} aria-hidden="true" />
          )}
          저장
        </button>
      )}
    </div>
  );
}
