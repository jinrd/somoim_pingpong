import styles from "./TeamFormationPanel.module.css";

interface Props {
  isOpen: boolean;
  isWorking: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function TeamFormationConfirmDialog({
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
        aria-labelledby="confirm-team-formation-title"
        aria-describedby="confirm-team-formation-description"
      >
        <h2 id="confirm-team-formation-title">이대로 팀원을 세팅할까요?</h2>

        <p id="confirm-team-formation-description">
          현재 팀 구성과 팀원 배치를 저장합니다.
        </p>

        <p>확정 후 수정하면 저장된 대진표와 라인업이 모두 초기화됩니다.</p>

        <div className={styles.confirmActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={isWorking}
            onClick={onCancel}
          >
            취소
          </button>

          <button
            type="button"
            className={styles.confirmFormationButton}
            disabled={isWorking}
            onClick={onConfirm}
          >
            {isWorking ? "세팅 중…" : "팀원 세팅"}
          </button>
        </div>
      </section>
    </div>
  );
}
