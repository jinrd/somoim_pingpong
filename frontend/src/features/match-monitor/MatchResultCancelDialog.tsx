import { Loader2, RotateCcw, X } from "lucide-react";

import useModalDialog from "../../hooks/useModalDialog";
import type { CancelTarget } from "./types";

import styles from "./MatchMonitorPanel.module.css";

interface Props {
  target: CancelTarget | null;
  reason: string;
  error: string;
  isWorking: boolean;
  onReasonChange: (reason: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export default function MatchResultCancelDialog({
  target,
  reason,
  error,
  isWorking,
  onReasonChange,
  onClose,
  onConfirm,
}: Props) {
  const dialogRef = useModalDialog<HTMLElement>({
    isOpen: Boolean(target),
    onClose,
    canClose: !isWorking,
  });

  if (!target) {
    return null;
  }

  return (
    <div
      className={styles.modalBackdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isWorking) {
          onClose();
        }
      }}
    >
      <section
        ref={dialogRef}
        className={styles.cancelModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-result-title"
      >
        <header>
          <div>
            <span>경기 결과 취소</span>
            <h3 id="cancel-result-title">{target.title}</h3>
          </div>

          <button
            type="button"
            className={styles.modalCloseButton}
            disabled={isWorking}
            onClick={onClose}
            aria-label="결과 취소 창 닫기"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className={styles.cancelWarning}>
          <strong>확정된 경기 결과를 취소하시겠습니까?</strong>
          <p>
            선택한 경기의 확정 점수가 삭제되고 결과를 다시 입력할 수 있게 됩니다.
          </p>
        </div>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <label className={styles.reasonField}>
          <span>취소 사유</span>
          <textarea
            value={reason}
            maxLength={500}
            rows={4}
            disabled={isWorking}
            placeholder="예: 점수가 잘못 입력되어 결과를 다시 입력합니다."
            onChange={(event) => onReasonChange(event.target.value)}
          />
          <small>{reason.length}/500</small>
        </label>

        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.modalCancelButton}
            disabled={isWorking}
            onClick={onClose}
          >
            돌아가기
          </button>

          <button
            type="button"
            className={styles.confirmCancelButton}
            disabled={isWorking}
            onClick={onConfirm}
          >
            {isWorking ? (
              <Loader2
                className={styles.spinner}
                size={17}
                aria-hidden="true"
              />
            ) : (
              <RotateCcw size={17} aria-hidden="true" />
            )}
            결과 취소 확정
          </button>
        </div>
      </section>
    </div>
  );
}
