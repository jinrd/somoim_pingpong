import type { StoredIndividualScheduleRound } from "./api";
import type { RoundRobinSchedule } from "./generateRoundRobin";

import styles from "./SchedulePanel.module.css";

interface PreviewProps {
  schedule: RoundRobinSchedule;
}

export function IndividualSchedulePreviewRounds({ schedule }: PreviewProps) {
  return (
    <div className={styles.roundList}>
      {schedule.rounds.map((round) => (
        <article
          key={`preview-round-${round.round}`}
          className={styles.roundCard}
        >
          <header>
            <h3>라운드 {round.round}</h3>

            {round.byeTeam && <span>(휴식: {round.byeTeam.name})</span>}
          </header>

          <div className={styles.matchList}>
            {round.matches.map((match) => (
              <div key={match.key} className={styles.matchCard}>
                <div className={styles.singleMatchRow}>
                  <strong className={styles.playerName}>{match.homeTeamName}</strong>
                  <span className={styles.vsText}>vs</span>
                  <strong className={styles.playerName}>{match.awayTeamName}</strong>
                </div>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

interface StoredProps {
  rounds: StoredIndividualScheduleRound[];
}

export function IndividualScheduleStoredRounds({ rounds }: StoredProps) {
  return (
    <div className={styles.roundList}>
      {rounds.map((round) => (
        <article
          key={`stored-round-${round.round}`}
          className={styles.roundCard}
        >
          <header>
            <h3>라운드 {round.round}</h3>

            {round.byeParticipant && (
              <span>(휴식: {round.byeParticipant.name})</span>
            )}
          </header>

          <div className={styles.matchList}>
            {round.matches.map((match) => (
              <div key={match.id} className={styles.matchCard}>
                <div className={styles.singleMatchRow}>
                  <strong className={styles.playerName}>{match.homeParticipant.name}</strong>
                  <span className={styles.vsText}>vs</span>
                  <strong className={styles.playerName}>{match.awayParticipant.name}</strong>
                  <span className={styles.formatText}>단식({match.bestOf}판)</span>
                  {match.tableNumber > 0 && (
                    <strong className={styles.tableBadge}>T{match.tableNumber}</strong>
                  )}
                </div>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
