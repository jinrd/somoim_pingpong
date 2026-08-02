import { RefreshCw } from "lucide-react";

import styles from "./MatchMonitorPanel.module.css";

interface Props {
  isLoading: boolean;
  onRefresh: () => void;
}

export default function MatchMonitorHeader({ isLoading, onRefresh }: Props) {
  return (
    <header className={styles.header}>
      <div>
        <h2>경기 진행</h2>
        <p>경기 상태는 5초마다 자동으로 갱신됩니다.</p>
      </div>

      <button
        type="button"
        className={styles.refreshButton}
        disabled={isLoading}
        onClick={onRefresh}
      >
        <RefreshCw size={17} aria-hidden="true" />
        <span className={styles.buttonText}>새로고침</span>
      </button>
    </header>
  );
}
