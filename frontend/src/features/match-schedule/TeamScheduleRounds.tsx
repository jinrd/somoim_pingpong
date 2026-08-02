import type { StoredScheduleRound, TeamScheduleContext } from "./api";
import type { ScheduledRound } from "./generateRoundRobin";

import styles from "./SchedulePanel.module.css";

interface PreviewProps {
  rounds: ScheduledRound[];
  formats: TeamScheduleContext["formats"];
}

interface StoredProps {
  rounds: StoredScheduleRound[];
}

const getMatchTypeLabel = (matchType: "singles" | "doubles"): string =>
  matchType === "singles" ? "단식" : "복식";

export function TeamSchedulePreviewRounds({ rounds, formats }: PreviewProps) {
  return (
    <div className={styles.roundList}>
      {rounds.map((round) => (
        <article key={round.round} className={styles.roundCard}>
          <header>
            <h3>{round.round}라운드</h3>

            {round.byeTeam && <span>휴식: {round.byeTeam.name}</span>}
          </header>

          <div className={styles.matchList}>
            {round.matches.map((match) => (
              <div key={match.key} className={styles.matchCard}>
                <div className={styles.teams}>
                  <strong>{match.homeTeamName}</strong>
                  <span>VS</span>
                  <strong>{match.awayTeamName}</strong>
                </div>

                <div className={styles.formatList}>
                  {formats.map((format) => (
                    <span key={format.sequence}>
                      {format.sequence}. {getMatchTypeLabel(format.matchType)} ·{" "}
                      {format.bestOf}판
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

export function TeamScheduleStoredRounds({ rounds }: StoredProps) {
  if (rounds.length === 0) {
    return <div className={styles.empty}>저장된 대진이 없습니다.</div>;
  }

  return (
    <div className={styles.roundList}>
      {rounds.map((round) => (
        <article key={round.round} className={styles.roundCard}>
          <header>
            <h3>{round.round}라운드</h3>

            {round.byeTeam && <span>휴식: {round.byeTeam.name}</span>}
          </header>

          <div className={styles.matchList}>
            {round.matches.map((match) => (
              <div key={match.id} className={styles.matchCard}>
                <div className={styles.teams}>
                  <strong>{match.homeTeam.name}</strong>
                  <span>VS</span>
                  <strong>{match.awayTeam.name}</strong>
                </div>

                <div className={styles.formatList}>
                  {match.games.map((game) => (
                    <span key={game.id}>
                      {game.sequence}. {getMatchTypeLabel(game.matchType)} ·{" "}
                      {game.bestOf}판
                    </span>
                  ))}
                </div>

              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
