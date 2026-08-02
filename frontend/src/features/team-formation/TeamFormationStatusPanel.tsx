import styles from "./TeamFormationPanel.module.css";

interface Props {
  message: string;
  isError?: boolean;
  onRetry?: () => void;
}

export default function TeamFormationStatusPanel({
  message,
  isError = false,
  onRetry,
}: Props) {
  return (
    <section className={styles.panel}>
      <h2>팀 편성</h2>

      <p
        className={isError ? styles.error : styles.notice}
        role={isError ? "alert" : undefined}
      >
        {message}
      </p>

      {onRetry && (
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={onRetry}
        >
          다시 불러오기
        </button>
      )}
    </section>
  );
}
