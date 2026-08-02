import styles from "./MatchMonitorPanel.module.css";

interface Props {
  error: string;
  message: string;
}

export default function MatchMonitorFeedback({ error, message }: Props) {
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
