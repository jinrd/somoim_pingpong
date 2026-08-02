import styles from "./GameSettings.module.css";

interface Props {
  isOpen: boolean;
  isWorking: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function GameSettingConfirmDialog({
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
        aria-labelledby="confirm-game-setting-title"
        aria-describedby="confirm-game-setting-description"
      >
        <h2 id="confirm-game-setting-title">게임 설정을 최종 확정할까요?</h2>

        <p id="confirm-game-setting-description">
          현재 저장된 게임 설정과 세부 경기 구성을 최종 확정합니다.
        </p>

        <p>
          확정 후 수정하려면 팀 편성, 대진표와 라인업을 포함한 기존 경기 구성이
          모두 초기화됩니다.
        </p>

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
            className={styles.confirmSettingButton}
            disabled={isWorking}
            onClick={onConfirm}
          >
            {isWorking ? "확정 처리 중…" : "최종 확정"}
          </button>
        </div>
      </section>
    </div>
  );
}
