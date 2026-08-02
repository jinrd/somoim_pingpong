import styles from "./Events.module.css";

interface Props {
  isOpen: boolean;
  isWorking: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ParticipationCloseDialog({
  isOpen,
  isWorking,
  onCancel,
  onConfirm,
}: Props) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.confirmOverlay}>
      <section
        className={styles.confirmDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="close-participation-title"
        aria-describedby="close-participation-description"
      >
        <h2 id="close-participation-title">참가 신청을 최종 마감할까요?</h2>

        <p id="close-participation-description">
          마감 후에는 다시 열 수 없으며 참석자를 추가하거나 삭제할 수 없습니다.
        </p>

        <p>
          운영진은 기존 참석자의 게임 참가·미참가 상태만 변경할 수 있습니다.
        </p>

        <div className={styles.confirmActions}>
          <button
            type="button"
            className={styles.cancelButton}
            disabled={isWorking}
            onClick={onCancel}
          >
            취소
          </button>

          <button
            type="button"
            className={styles.confirmCloseButton}
            disabled={isWorking}
            onClick={onConfirm}
          >
            {isWorking ? "마감 처리 중…" : "확인하고 최종 마감"}
          </button>
        </div>
      </section>
    </div>
  );
}
