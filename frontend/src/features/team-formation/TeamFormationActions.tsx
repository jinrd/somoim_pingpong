import type { TeamDraft, TeamFormationStatus } from "./types";

import styles from "./TeamFormationPanel.module.css";

interface Props {
  teams: TeamDraft[];
  status: TeamFormationStatus;
  isWorking: boolean;
  onUnlock: () => void;
  onConfirmRequest: () => void;
}

export default function TeamFormationActions({
  teams,
  status,
  isWorking,
  onUnlock,
  onConfirmRequest,
}: Props) {
  const hasEmptyTeam = teams.some((team) => team.members.length === 0);

  if (status === "confirmed") {
    return (
      <footer className={styles.saveBar}>
        <button
          type="button"
          className={styles.dangerButton}
          disabled={isWorking}
          onClick={onUnlock}
        >
          세팅 수정
        </button>
      </footer>
    );
  }

  return (
    <footer className={styles.saveBar}>
      <button
        type="button"
        className={styles.primaryButton}
        disabled={isWorking || teams.length < 2 || hasEmptyTeam}
        onClick={onConfirmRequest}
      >
        팀원 세팅
      </button>
    </footer>
  );
}
