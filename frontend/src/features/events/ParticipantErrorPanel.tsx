import { RefreshCw } from "lucide-react";

import styles from "./Events.module.css";

interface Props {
  message: string;
  isLoading: boolean;
  isWorking: boolean;
  onRetry: () => void;
}

export default function ParticipantErrorPanel({
  message,
  isLoading,
  isWorking,
  onRetry,
}: Props) {
  if (!message) {
    return null;
  }

  return (
    <div className={styles.errorPanel} role="alert">
      <p>{message}</p>

      <button
        type="button"
        className={styles.retryButton}
        disabled={isLoading || isWorking}
        onClick={onRetry}
      >
        <RefreshCw size={17} aria-hidden="true" />
        다시 불러오기
      </button>
    </div>
  );
}
