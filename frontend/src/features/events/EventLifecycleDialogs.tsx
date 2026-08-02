import {
  Archive,
  CircleStop,
  Loader2,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import type { SomoimEvent } from "./types";
import styles from "./Events.module.css";

interface DialogState {
  isOpen: boolean;
  isWorking: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
}

interface Props {
  eventRecord: SomoimEvent;
  deleteDialog: DialogState;
  archiveDialog: DialogState;
  forceCompleteDialog: DialogState;
}

interface ConfirmDialogProps {
  isOpen: boolean;
  isWorking: boolean;
  error: string;
  titleId: string;
  descriptionId: string;
  title: string;
  description: ReactNode;
  warning: string;
  cancelLabel: string;
  confirmLabel: string;
  confirmClassName: string;
  icon: LucideIcon;
  onClose: () => void;
  onConfirm: () => void;
}

function ConfirmDialog({
  isOpen,
  isWorking,
  error,
  titleId,
  descriptionId,
  title,
  description,
  warning,
  cancelLabel,
  confirmLabel,
  confirmClassName,
  icon: Icon,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.confirmOverlay}>
      <section
        className={styles.confirmDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <h2 id={titleId}>{title}</h2>

        <p id={descriptionId}>{description}</p>

        <p>{warning}</p>

        {error && (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        )}

        <div className={styles.confirmActions}>
          <button
            type="button"
            className={styles.cancelButton}
            disabled={isWorking}
            onClick={onClose}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            className={confirmClassName}
            disabled={isWorking}
            onClick={onConfirm}
          >
            {isWorking ? (
              <Loader2
                size={17}
                className={styles.spinner}
                aria-hidden="true"
              />
            ) : (
              <Icon size={17} aria-hidden="true" />
            )}

            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export default function EventLifecycleDialogs({
  eventRecord,
  deleteDialog,
  archiveDialog,
  forceCompleteDialog,
}: Props) {
  return (
    <>
      <ConfirmDialog
        {...deleteDialog}
        titleId="delete-event-title"
        descriptionId="delete-event-description"
        title="회차를 삭제할까요?"
        description={
          <>
            {eventRecord.title} 회차와 참석자, 게임 설정, 팀 편성 및 저장된
            대진이 모두 삭제됩니다.
          </>
        }
        warning="삭제한 내용은 되돌릴 수 없습니다."
        cancelLabel="취소"
        confirmLabel="삭제"
        confirmClassName={styles.confirmCloseButton}
        icon={Trash2}
      />

      <ConfirmDialog
        {...archiveDialog}
        titleId="archive-event-title"
        descriptionId="archive-event-description"
        title="종료된 회차를 보관할까요?"
        description="경기 및 결과 기록은 그대로 유지되고 공개 링크는 비활성화됩니다."
        warning="보관한 회차는 다시 진행 상태로 되돌릴 수 없습니다."
        cancelLabel="취소"
        confirmLabel="보관"
        confirmClassName={styles.confirmArchiveButton}
        icon={Archive}
      />

      <ConfirmDialog
        {...forceCompleteDialog}
        titleId="force-complete-event-title"
        descriptionId="force-complete-event-description"
        title="회차를 강제로 종료할까요?"
        description={
          <>
            완료된 경기 결과는 유지되고, 아직 끝나지 않은 모든 경기는
            취소됩니다.
          </>
        }
        warning="취소된 경기는 자동으로 다시 시작되지 않습니다."
        cancelLabel="돌아가기"
        confirmLabel="남은 경기 취소 후 종료"
        confirmClassName={styles.confirmCloseButton}
        icon={CircleStop}
      />
    </>
  );
}
