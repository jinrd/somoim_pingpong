import styles from "./Events.module.css";

interface Props {
  totalCount: number;
  playingCount: number;
  notPlayingCount: number;
  undecidedCount: number;
}

export default function ParticipantSummary({
  totalCount,
  playingCount,
  notPlayingCount,
  undecidedCount,
}: Props) {
  return (
    <div className={styles.participantSummaryGrid}>
      <div className={styles.summaryCard}>
        <span>전체 참석자</span>
        <strong>{totalCount}</strong>
      </div>

      <div className={styles.summaryCard}>
        <span>게임 참가</span>
        <strong>{playingCount}</strong>
      </div>

      <div className={styles.summaryCard}>
        <span>게임 미참가</span>
        <strong>{notPlayingCount}</strong>
      </div>

      <div className={styles.summaryCard}>
        <span>미정</span>
        <strong>{undecidedCount}</strong>
      </div>
    </div>
  );
}
