import styles from "./SchedulePanel.module.css";

interface Props {
  message: string;
  isError?: boolean;
  onRetry?: () => void;
}

export default function ScheduleStatusPanel({
  message,
  isError = false,
  onRetry,
}: Props) {
  return (
    <section className={styles.panel}>
      <h2>대진표</h2>

      <p
        className={isError ? styles.error : undefined}
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
