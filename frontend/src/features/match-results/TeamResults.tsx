import type {
  StoredTeamMatch,
  TeamScheduleContext,
} from "../match-schedule/api";

import MatchResultStatus from "./MatchResultStatus";
import {
  getMatchTypeLabel,
  getPlayersLabel,
  getScoreLabel,
} from "./resultFormatters";

import styles from "./MatchResultsPanel.module.css";

export default function TeamResults({
  schedule,
}: {
  schedule: TeamScheduleContext;
}) {
  const matches = schedule.rounds.flatMap((round) => round.matches);

  if (matches.length === 0) {
    return <p className={styles.empty}>저장된 팀 대진이 없습니다.</p>;
  }

  return (
    <>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>순서</th>
              <th>팀 대결</th>
              <th>세부 경기</th>
              <th>출전 선수</th>
              <th>점수</th>
              <th>상태</th>
            </tr>
          </thead>

          {matches.map((match: StoredTeamMatch) => (
            <tbody key={match.id} className={styles.teamMatchGroup}>
              {match.games.map((game, gameIndex) => (
                <tr
                  key={game.id}
                  className={
                    game.resultStatus === "pending"
                      ? styles.pendingResult
                      : ""
                  }
                >
                  {gameIndex === 0 && (
                    <td rowSpan={match.games.length}>
                      경기 {match.sortOrder}
                      <small>{match.round}라운드</small>
                    </td>
                  )}

                  {gameIndex === 0 && (
                    <td rowSpan={match.games.length}>
                      <div className={styles.teamMatchup}>
                        <strong>{match.homeTeam.name}</strong>
                        <span>VS</span>
                        <strong>{match.awayTeam.name}</strong>
                      </div>
                    </td>
                  )}

                  <td>
                    {game.sequence}. {getMatchTypeLabel(game.matchType)}
                  </td>

                  <td>
                    <div className={styles.playerMatchup}>
                      <span>{getPlayersLabel(game.homePlayers)}</span>
                      <span>VS</span>
                      <span>{getPlayersLabel(game.awayPlayers)}</span>
                    </div>
                  </td>

                  <td>
                    <strong className={styles.score}>
                      {getScoreLabel(
                        game.resultStatus,
                        game.homeScore,
                        game.awayScore,
                      )}
                    </strong>
                  </td>

                  <td>
                    <MatchResultStatus
                      status={game.resultStatus}
                      submissionCount={game.submissionCount}
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
                <article key={match.id} className={styles.mobileResultCard}>
                  <header>
                    <span>경기 {match.sortOrder}</span>
                    <strong>
                      {match.homeTeam.name} VS {match.awayTeam.name}
                    </strong>
                  </header>

                  <div className={styles.mobileGameList}>
                    {match.games.map((game) => (
                      <div
                        key={game.id}
                        className={`${styles.mobileGameResult} ${
                          game.resultStatus === "pending"
                            ? styles.pendingResult
                            : ""
                        }`}
                      >
                        <div className={styles.mobileGameHeader}>
                          <strong>
                            {game.sequence}. {getMatchTypeLabel(game.matchType)}
                          </strong>
                          <MatchResultStatus
                            status={game.resultStatus}
                            submissionCount={game.submissionCount}
                          />
                        </div>

                        <div className={styles.mobileResultScore}>
                          <div>
                            <strong>{match.homeTeam.name}</strong>
                            <span>{getPlayersLabel(game.homePlayers)}</span>
                          </div>
                          <strong>
                            {getScoreLabel(
                              game.resultStatus,
                              game.homeScore,
                              game.awayScore,
                            )}
                          </strong>
                          <div>
                            <strong>{match.awayTeam.name}</strong>
                            <span>{getPlayersLabel(game.awayPlayers)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
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
