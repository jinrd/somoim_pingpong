import styles from "./SchedulePanel.module.css";

interface Props {
  error: string;
  message: string;
}

export default function ScheduleFeedback({ error, message }: Props) {
  if (!error && !message) {
    return null;
  }

  return (
    <>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {message && (
        <p className={styles.success} role="status">
          {message}
        </p>
      )}
    </>
  );
}
