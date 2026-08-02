import styles from "./GameSettings.module.css";

interface Props {
  error: string;
  message: string;
  onErrorDismiss: () => void;
}

export default function GameSettingsFeedback({
  error,
  message,
  onErrorDismiss,
}: Props) {
  if (!error && !message) {
    return null;
  }

  return (
    <>
      {error && (
        <div className={styles.confirmOverlay}>
          <section
            className={styles.confirmDialog}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="game-setting-error-title"
            aria-describedby="game-setting-error-description"
          >
            <h2 id="game-setting-error-title">확인 필요</h2>
            <p id="game-setting-error-description">{error}</p>

            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.confirmSettingButton}
                autoFocus
                onClick={onErrorDismiss}
              >
                확인
              </button>
            </div>
          </section>
        </div>
      )}

      {message && (
        <p className={styles.success} role="status">
          {message}
        </p>
      )}
    </>
  );
}
