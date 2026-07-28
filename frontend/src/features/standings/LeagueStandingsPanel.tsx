import { useCallback, useEffect, useState } from "react";

import { AlertTriangle, RefreshCw } from "lucide-react";

import { ClientResponseError } from "pocketbase";

import type { EventGameSetting } from "../game-settings/types";

import { getAdminStandings, getPublicStandings } from "./api";

import type { StandingsMatch, StandingsResponse } from "./types";

import styles from "./LeagueStandingsPanel.module.css";

interface LeagueStandingsPanelProps {
  setting?: EventGameSetting | null;
  responseToken?: string;
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof ClientResponseError) {
    return (
      error.response?.message ||
      error.message ||
      "경기 현황을 불러오지 못했습니다."
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "경기 현황을 불러오지 못했습니다.";
};

const getMatchForEntities = (
  matches: StandingsMatch[],
  rowId: string,
  columnId: string,
): StandingsMatch | undefined => {
  return matches.find(
    (match) =>
      (match.homeEntity.id === rowId && match.awayEntity.id === columnId) ||
      (match.homeEntity.id === columnId && match.awayEntity.id === rowId),
  );
};

const getCellScore = (match: StandingsMatch, rowId: string): string => {
  if (match.resultStatus === "disputed") {
    return "불일치";
  }

  if (match.resultStatus !== "confirmed") {
    return match.status === "in_progress" ? "진행" : "대기";
  }

  if (match.homeEntity.id === rowId) {
    return `${match.homeScore}:${match.awayScore}`;
  }

  return `${match.awayScore}:${match.homeScore}`;
};

const orientMatchForRow = (
  match: StandingsMatch,
  rowEntityId: string,
): StandingsMatch => {
  if (match.homeEntity.id === rowEntityId) {
    return match;
  }

  return {
    ...match,
    homeEntity: match.awayEntity,
    awayEntity: match.homeEntity,
    homeScore: match.awayScore,
    awayScore: match.homeScore,
    winnerEntityId: match.winnerEntityId,

    games: match.games.map((game) => ({
      ...game,
      homeScore: game.awayScore,
      awayScore: game.homeScore,
      winnerSide:
        game.winnerSide === "home"
          ? "away"
          : game.winnerSide === "away"
            ? "home"
            : "",
      homePlayers: game.awayPlayers,
      awayPlayers: game.homePlayers,
    })),
  };
};

export default function LeagueStandingsPanel({
  setting,
  responseToken,
}: LeagueStandingsPanelProps) {
  const [response, setResponse] = useState<StandingsResponse | null>(null);

  const [selectedMatch, setSelectedMatch] = useState<StandingsMatch | null>(
    null,
  );

  const [isLoading, setIsLoading] = useState(true);

  const [error, setError] = useState("");

  const loadStandings = useCallback(async () => {
    if (!setting && !responseToken) {
      return;
    }

    setError("");

    try {
      const result = setting
        ? await getAdminStandings(setting.id)
        : await getPublicStandings(responseToken || "");

      setResponse(result);

      setSelectedMatch((current) => {
        if (!current) {
          return null;
        }

        const updatedMatch = result.matches.find(
          (match) => match.id === current.id,
        );

        return updatedMatch
          ? orientMatchForRow(updatedMatch, current.homeEntity.id)
          : null;
      });
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setIsLoading(false);
    }
  }, [responseToken, setting]);

  useEffect(() => {
    if (!setting && !responseToken) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const result = setting
          ? await getAdminStandings(setting.id)
          : await getPublicStandings(responseToken || "");

        if (!cancelled) {
          setResponse(result);
          setError("");
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(getErrorMessage(caughtError));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    const firstLoadId = window.setTimeout(() => {
      void load();
    }, 0);

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void load();
      }
    }, 5000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void load();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;

      window.clearTimeout(firstLoadId);
      window.clearInterval(intervalId);

      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [responseToken, setting]);

  if (isLoading && !response) {
    return (
      <section className={styles.panel}>
        실시간 경기 현황을 불러오는 중입니다…
      </section>
    );
  }

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div>
          <h2>실시간 경기 현황</h2>

          <p>확정된 결과와 순위를 5초마다 갱신합니다.</p>
        </div>

        <button
          type="button"
          className={styles.refreshButton}
          disabled={isLoading}
          onClick={() => {
            void loadStandings();
          }}
        >
          <RefreshCw size={17} aria-hidden="true" />
          새로고침
        </button>
      </header>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {!response || response.entities.length === 0 ? (
        <p className={styles.empty}>표시할 리그 대진이 없습니다.</p>
      ) : (
        <>
          <div className={styles.matrixScroll}>
            <table className={styles.matrix}>
              <thead>
                <tr>
                  <th className={styles.nameHeader}>
                    {response.competitionType === "team_league"
                      ? "팀"
                      : "참가자"}
                  </th>

                  {response.entities.map((entity, index) => (
                    <th key={entity.id}>
                      <span className={styles.columnNumber}>{index + 1}</span>

                      <span className={styles.columnName}>{entity.name}</span>
                    </th>
                  ))}

                  <th>경기</th>
                  <th>승</th>
                  <th>패</th>
                  <th>승점</th>
                  <th>세트 득실률</th>
                  <th>순위</th>
                </tr>
              </thead>

              <tbody>
                {response.entities.map((rowEntity, rowIndex) => {
                  const row = response.standings.find(
                    (standing) => standing.entityId === rowEntity.id,
                  );

                  return (
                    <tr key={rowEntity.id}>
                      <th className={styles.rowHeader}>
                        <span>{rowIndex + 1}</span>

                        <strong>{rowEntity.name}</strong>
                      </th>

                      {response.entities.map((columnEntity) => {
                        if (rowEntity.id === columnEntity.id) {
                          return (
                            <td
                              key={columnEntity.id}
                              className={styles.selfCell}
                            >
                              —
                            </td>
                          );
                        }

                        const match = getMatchForEntities(
                          response.matches,
                          rowEntity.id,
                          columnEntity.id,
                        );

                        if (!match) {
                          return (
                            <td
                              key={columnEntity.id}
                              className={styles.emptyCell}
                            >
                              -
                            </td>
                          );
                        }

                        const rowWon = match.winnerEntityId === rowEntity.id;

                        const rowLost =
                          Boolean(match.winnerEntityId) && !rowWon;

                        return (
                          <td key={columnEntity.id}>
                            <button
                              type="button"
                              className={
                                match.resultStatus === "disputed"
                                  ? styles.disputedCell
                                  : rowWon
                                    ? styles.winCell
                                    : rowLost
                                      ? styles.lossCell
                                      : styles.resultCell
                              }
                              onClick={() =>
                                setSelectedMatch(
                                  orientMatchForRow(match, rowEntity.id),
                                )
                              }
                            >
                              {getCellScore(match, rowEntity.id)}
                            </button>
                          </td>
                        );
                      })}

                      <td>{row?.played ?? 0}</td>

                      <td>{row?.wins ?? 0}</td>
                      <td>{row?.losses ?? 0}</td>
                      <td>{row?.points ?? 0}</td>

                      <td>
                        {row
                          ? row.setRatio === null
                            ? row.scoreFor > 0
                              ? "∞"
                              : "-"
                            : row.setRatio.toFixed(3)
                          : "-"}
                      </td>

                      <td className={styles.rankCell}>{row?.rank ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selectedMatch && (
            <MatchDetail
              match={selectedMatch}
              competitionType={response.competitionType}
              onClose={() => setSelectedMatch(null)}
            />
          )}
        </>
      )}
    </section>
  );
}

const MatchDetail = ({
  match,
  competitionType,
  onClose,
}: {
  match: StandingsMatch;
  competitionType: "team_league" | "individual_singles";
  onClose: () => void;
}) => {
  return (
    <section className={styles.detail}>
      <header>
        <div>
          <span>선택 경기</span>

          <h3>
            {match.homeEntity.name} VS {match.awayEntity.name}
          </h3>
        </div>

        <button type="button" onClick={onClose}>
          닫기
        </button>
      </header>

      {competitionType === "individual_singles" ? (
        <div className={styles.detailScore}>
          <strong>
            {match.resultStatus === "confirmed" ? match.homeScore : "-"}
          </strong>

          <span>:</span>

          <strong>
            {match.resultStatus === "confirmed" ? match.awayScore : "-"}
          </strong>
        </div>
      ) : (
        <div className={styles.gameList}>
          {match.games.map((game) => (
            <article key={game.id}>
              <div>
                <strong>
                  {game.sequence}.{" "}
                  {game.matchType === "singles" ? "단식" : "복식"}
                </strong>

                {game.resultStatus === "disputed" && (
                  <span className={styles.detailWarning}>
                    <AlertTriangle size={14} aria-hidden="true" />
                    입력 불일치
                  </span>
                )}
              </div>

              <p>
                {game.homePlayers.map((player) => player.name).join(" · ") ||
                  "미정"}

                <strong>
                  {game.resultStatus === "confirmed"
                    ? ` ${game.homeScore} : ${game.awayScore} `
                    : " - : - "}
                </strong>

                {game.awayPlayers.map((player) => player.name).join(" · ") ||
                  "미정"}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
