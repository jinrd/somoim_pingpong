import { useCallback, useEffect, useState } from "react";

import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Clock3,
  RefreshCw,
} from "lucide-react";
import { ClientResponseError } from "pocketbase";

import type { EventGameSetting } from "../game-settings/types";

import { getAdminStandings, getPublicStandings } from "./api";

import type { StandingsMatch, StandingsResponse } from "./types";

import styles from "./LeagueStandingsPanel.module.css";

interface LeagueStandingsPanelProps {
  setting?: EventGameSetting | null;
  responseToken?: string;
}

type MobileStandingsView = "order" | "ranking" | "matrix";

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
const getMatchStatusLabel = (match: StandingsMatch): string => {
  if (match.resultStatus === "disputed") {
    return "입력 불일치";
  }

  if (match.resultStatus === "confirmed") {
    return "경기 완료";
  }

  if (match.status === "in_progress") {
    return "진행 중";
  }

  if (match.status === "cancelled") {
    return "취소";
  }

  return "대기";
};

const getMatchStatusClassName = (match: StandingsMatch): string => {
  if (match.resultStatus === "disputed") {
    return styles.orderStatusDisputed;
  }

  if (match.resultStatus === "confirmed") {
    return styles.orderStatusCompleted;
  }

  if (match.status === "in_progress") {
    return styles.orderStatusProgress;
  }

  return styles.orderStatusWaiting;
};

const getMatchStatusIcon = (match: StandingsMatch) => {
  if (match.resultStatus === "confirmed") {
    return <CheckCircle2 size={16} aria-hidden="true" />;
  }

  if (match.resultStatus === "disputed" || match.status === "in_progress") {
    return <CircleDot size={16} aria-hidden="true" />;
  }

  return <Clock3 size={16} aria-hidden="true" />;
};

const getOrderedMatchResult = (match: StandingsMatch): string => {
  if (match.resultStatus === "confirmed") {
    return `${match.homeScore} : ${match.awayScore}`;
  }

  if (match.resultStatus === "disputed") {
    return "점수 확인 필요";
  }

  return "- : -";
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
  const [mobileView, setMobileView] =
    useState<MobileStandingsView>("order");

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
  const orderedMatches = response
    ? [...response.matches].sort((left, right) => {
        if (left.sortOrder !== right.sortOrder) {
          return left.sortOrder - right.sortOrder;
        }

        return left.round - right.round;
      })
    : [];

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div>
          <h2>전체 경기 현황</h2>

          <p className={styles.updateStatus}>
            <span aria-hidden="true" />
            자동 업데이트
          </p>
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
          <span className={styles.buttonText}>새로고침</span>
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
          <nav
            className={styles.mobileViewTabs}
            aria-label="실시간 경기 현황 보기"
          >
            <button
              type="button"
              className={
                mobileView === "order"
                  ? styles.mobileViewTabActive
                  : styles.mobileViewTab
              }
              onClick={() => setMobileView("order")}
            >
              경기 순서
            </button>

            <button
              type="button"
              className={
                mobileView === "ranking"
                  ? styles.mobileViewTabActive
                  : styles.mobileViewTab
              }
              onClick={() => setMobileView("ranking")}
            >
              순위
            </button>

            <button
              type="button"
              className={
                mobileView === "matrix"
                  ? styles.mobileViewTabActive
                  : styles.mobileViewTab
              }
              onClick={() => setMobileView("matrix")}
            >
              리그표
            </button>
          </nav>

          <section
            className={`${styles.orderSection} ${
              mobileView !== "order" ? styles.mobileViewHidden : ""
            }`}
          >
            <header className={styles.orderHeader}>
              <div>
                <h3>전체 경기 순서</h3>

                <p>관리자가 지정한 순서와 현재 경기 상태를 표시합니다.</p>
              </div>

              <span>{orderedMatches.length}경기</span>
            </header>

            {orderedMatches.length === 0 ? (
              <p className={styles.empty}>저장된 경기 순서가 없습니다.</p>
            ) : (
              <div className={styles.orderList}>
                {orderedMatches.map((match) => (
                  <button
                    key={match.id}
                    type="button"
                    className={
                      match.status === "in_progress"
                        ? styles.orderCardActive
                        : styles.orderCard
                    }
                    onClick={() => {
                      setSelectedMatch(match);
                    }}
                  >
                    <span className={styles.desktopOrderContent}>
                      <span className={styles.orderNumber}>
                        <small>경기</small>
                        <strong>{match.sortOrder}</strong>
                      </span>

                      <span className={styles.orderMatch}>
                        <small>{match.round}라운드</small>

                        <strong>
                          {match.homeEntity.name}
                          <span> VS </span>
                          {match.awayEntity.name}
                        </strong>
                      </span>

                      <span className={styles.orderScore}>
                        {getOrderedMatchResult(match)}
                      </span>

                      <span
                        className={`${styles.orderStatus} ${getMatchStatusClassName(
                          match,
                        )}`}
                      >
                        {getMatchStatusIcon(match)}
                        {getMatchStatusLabel(match)}
                      </span>
                    </span>

                    <span className={styles.mobileOrderContent}>
                      <span className={styles.mobileOrderHeader}>
                        <strong>경기 {match.sortOrder}</strong>
                        <span>{match.round}라운드</span>

                        <span
                          className={`${styles.orderStatus} ${getMatchStatusClassName(
                            match,
                          )}`}
                        >
                          {getMatchStatusIcon(match)}
                          {getMatchStatusLabel(match)}
                        </span>
                      </span>

                      <span className={styles.mobileOrderMatchup}>
                        <strong>{match.homeEntity.name}</strong>
                        <span className={styles.mobileOrderScore}>
                          {getOrderedMatchResult(match)}
                        </span>
                        <strong>{match.awayEntity.name}</strong>
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section
            className={`${styles.mobileRanking} ${
              mobileView !== "ranking" ? styles.mobileViewHidden : ""
            }`}
          >
            <header className={styles.mobileRankingHeader}>
              <div>
                <h3>현재 순위</h3>
                <p>승점, 승자승, 세트 득실률 순으로 계산합니다.</p>
              </div>
            </header>

            <div className={styles.mobileRankingList}>
              {response.standings.map((row) => (
                <article
                  key={row.entityId}
                  className={styles.rankingCard}
                  data-rank={row.rank}
                >
                  <strong className={styles.rankingPosition}>
                    {row.rank}
                    <small>위</small>
                  </strong>

                  <div className={styles.rankingIdentity}>
                    <strong>{row.name}</strong>
                    <span>
                      {row.played}경기 · {row.wins}승 {row.losses}패
                    </span>
                  </div>

                  <dl className={styles.rankingStats}>
                    <div>
                      <dt>승점</dt>
                      <dd>{row.points}</dd>
                    </div>
                    <div>
                      <dt>세트 득실률</dt>
                      <dd>
                        {row.setRatio === null
                          ? row.scoreFor > 0
                            ? "∞"
                            : "-"
                          : row.setRatio.toFixed(3)}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </section>

          <div
            className={`${styles.matrixScroll} ${
              mobileView !== "matrix" ? styles.mobileViewHidden : ""
            }`}
          >
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
            <div
              className={styles.detailBackdrop}
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setSelectedMatch(null);
                }
              }}
            >
              <MatchDetail
                match={selectedMatch}
                competitionType={response.competitionType}
                onClose={() => setSelectedMatch(null)}
              />
            </div>
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
          <span>
            {match.round}라운드 · {match.sortOrder}번째 경기
          </span>

          <h3 className={styles.detailTitle}>
            <span>{match.homeEntity.name}</span>
            <small>VS</small>
            <span>{match.awayEntity.name}</span>
          </h3>
        </div>

        <button type="button" onClick={onClose}>
          닫기
        </button>
      </header>

      {competitionType === "individual_singles" ? (
        <div className={styles.detailScore}>
          <div className={styles.detailScoreSide}>
            <span>{match.homeEntity.name}</span>

            <strong>
              {match.resultStatus === "confirmed" ? match.homeScore : "-"}
            </strong>
          </div>

          <span className={styles.detailScoreDivider}>:</span>

          <div className={styles.detailScoreSide}>
            <span>{match.awayEntity.name}</span>

            <strong>
              {match.resultStatus === "confirmed" ? match.awayScore : "-"}
            </strong>
          </div>
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

              <div className={styles.gameScoreRow}>
                <span>
                  {game.homePlayers.map((player) => player.name).join(" · ") ||
                    "출전 미정"}
                </span>

                <strong>
                  {game.resultStatus === "confirmed"
                    ? `${game.homeScore} : ${game.awayScore}`
                    : "- : -"}
                </strong>

                <span>
                  {game.awayPlayers.map((player) => player.name).join(" · ") ||
                    "출전 미정"}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
