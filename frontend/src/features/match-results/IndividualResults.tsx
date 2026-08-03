import type { IndividualScheduleContext } from "../match-schedule/api";

import MatchResultStatus from "./MatchResultStatus";
import { getBestOfLabel, getScoreLabel } from "./resultFormatters";

import styles from "./MatchResultsPanel.module.css";

export default function IndividualResults({
  schedule,
}: {
  schedule: IndividualScheduleContext;
}) {
  const hasMatches = schedule.rounds.some((round) => round.matches.length > 0);

  if (!hasMatches) {
    return <p className={styles.empty}>저장된 개인 단식 대진이 없습니다.</p>;
  }

  return (
    <>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>순서</th>
              <th>경기</th>
              <th>방식</th>
              <th>점수</th>
              <th>상태</th>
            </tr>
          </thead>

          {schedule.rounds.map((round) => (
            <tbody key={round.round} className={styles.individualRoundGroup}>
              <tr className={styles.roundHeaderRow}>
                <th colSpan={5}>{round.round}라운드</th>
              </tr>

              {round.matches.map((match) => (
              <tr
                key={match.id}
                className={
                  match.resultStatus === "pending"
                    ? styles.pendingResult
                    : ""
                }
              >
                  <td>{match.sortOrder}</td>

                  <td>
                    <strong>{match.homeParticipant.name}</strong>

                    <span className={styles.versus}>VS</span>

                    <strong>{match.awayParticipant.name}</strong>
                  </td>

                  <td>{getBestOfLabel(match.bestOf)}</td>

                  <td>
                    <strong className={styles.score}>
                      {getScoreLabel(
                        match.resultStatus,
                        match.homeScore,
                        match.awayScore,
                      )}
                    </strong>
                  </td>

                  <td>
                    <MatchResultStatus
                      status={match.resultStatus}
                      submissionCount={match.submissionCount}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      <div className={styles.mobileResultList}>
        {schedule.rounds.map((round) => (
          <section key={round.round} className={styles.mobileRoundGroup}>
            <h3>{round.round}라운드</h3>

            <div className={styles.mobileRoundMatches}>
              {round.matches.map((match) => (
                <article
                  key={match.id}
                  className={`${styles.mobileResultCard} ${
                    match.resultStatus === "pending"
                      ? styles.pendingResult
                      : ""
                  }`}
                >
                  <header>
                    <span>
                      경기 {match.sortOrder} · {getBestOfLabel(match.bestOf)}
                    </span>

                    <MatchResultStatus
                      status={match.resultStatus}
                      submissionCount={match.submissionCount}
                    />
                  </header>

                  <div className={styles.mobileResultScore}>
                    <div>
                      <strong>{match.homeParticipant.name}</strong>
                    </div>

                    <strong>
                      {getScoreLabel(
                        match.resultStatus,
                        match.homeScore,
                        match.awayScore,
                      )}
                    </strong>

                    <div>
                      <strong>{match.awayParticipant.name}</strong>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
