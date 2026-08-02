import styles from "./TeamFormationPanel.module.css";

interface Props {
  error: string;
  message: string;
  warnings: string[];
}

export default function TeamFormationFeedback({
  error,
  message,
  warnings,
}: Props) {
  if (!error && !message && warnings.length === 0) {
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

      {warnings.map((warning) => (
        <p key={warning} className={styles.warning}>
          {warning}
        </p>
      ))}
    </>
  );
}
