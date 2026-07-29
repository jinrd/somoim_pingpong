import { useCallback, useEffect, useMemo, useState } from "react";

import { Loader2, RefreshCw, RotateCcw, X } from "lucide-react";

import { ClientResponseError } from "pocketbase";

import type { EventGameSetting } from "../game-settings/types";

import {
  cancelIndividualMatchResult,
  cancelTeamMatchResult,
  getIndividualSchedule,
  getTeamSchedule,
  type TeamMatchStatus,
} from "../match-schedule/api";

import { MATCH_MONITOR_REFRESH_INTERVAL_MS } from "./constants";

import styles from "./MatchMonitorPanel.module.css";

interface Props {
  setting: EventGameSetting | null;
}

interface MonitorMatch {
  id: string;
  round: number;
  sortOrder: number;
  status: TeamMatchStatus;
  version: number;
  title: string;
  description: string;
  canCancelResult: boolean;
  resultLines: string[];
  hasDisputedResult: boolean;
}

interface CancelTarget {
  id: string;
  title: string;
  version: number;
}

type MonitorFilter = "all" | "waiting" | "in_progress" | "completed";

const STATUS_LABELS: Record<TeamMatchStatus, string> = {
  scheduled: "대기 중",
  ready: "시작 가능",
  in_progress: "진행 중",
  completed: "완료",
  cancelled: "취소",
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof ClientResponseError) {
    return error.response?.message || error.message || fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
};

export default function MatchMonitorPanel({ setting }: Props) {
  const [matches, setMatches] = useState<MonitorMatch[]>([]);

  const [isLoading, setIsLoading] = useState(false);

  const [workingMatchId, setWorkingMatchId] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);

  const [cancelReason, setCancelReason] = useState("");
  const [activeFilter, setActiveFilter] = useState<MonitorFilter>("all");

  const loadMatches = useCallback(
    async (showLoading: boolean) => {
      if (!setting) {
        setMatches([]);
        return;
      }

      if (showLoading) {
        setIsLoading(true);
      }

      try {
        if (setting.competition_type === "team_league") {
          const schedule = await getTeamSchedule(setting.id);

          setMatches(
            schedule.rounds.flatMap((round) =>
              round.matches.map((match) => ({
                id: match.id,
                round: match.round,
                sortOrder: match.sortOrder,
                status: match.status,
                version: match.version,

                title: `${match.homeTeam.name} vs ${match.awayTeam.name}`,

                description:
                  match.homeLineupStatus === "confirmed" &&
                  match.awayLineupStatus === "confirmed"
                    ? match.status === "ready"
                      ? "양 팀 라인업 확정 · 현재 라운드 대기"
                      : "양 팀 라인업 확정"
                    : "라인업 확정 필요",
                resultLines: match.games.map((game) => {
                  const typeLabel =
                    game.matchType === "singles" ? "단식" : "복식";

                  const homePlayers =
                    game.homePlayers.map((player) => player.name).join("·") ||
                    "미정";

                  const awayPlayers =
                    game.awayPlayers.map((player) => player.name).join("·") ||
                    "미정";

                  if (game.resultStatus === "confirmed") {
                    return `${game.sequence}. ${typeLabel} ${homePlayers} ${game.homeScore} : ${game.awayScore} ${awayPlayers} · 확정`;
                  }

                  if (game.resultStatus === "disputed") {
                    return `${game.sequence}. ${typeLabel} ${homePlayers} vs ${awayPlayers} · 입력 불일치`;
                  }

                  if (game.submissionCount === 1) {
                    return `${game.sequence}. ${typeLabel} ${homePlayers} vs ${awayPlayers} · 상대 입력 대기`;
                  }

                  return `${game.sequence}. ${typeLabel} ${homePlayers} vs ${awayPlayers} · 결과 미입력`;
                }),
                canCancelResult: match.games.some(
                  (game) => game.resultStatus === "confirmed",
                ),
                hasDisputedResult: match.games.some(
                  (game) => game.resultStatus === "disputed",
                ),
              })),
            ),
          );
        } else if (setting.competition_type === "individual_singles") {
          const schedule = await getIndividualSchedule(setting.id);

          setMatches(
            schedule.rounds.flatMap((round) =>
              round.matches.map((match) => ({
                id: match.id,
                round: match.round,
                sortOrder: match.sortOrder,
                status: match.status,
                version: match.version,

                title: `${match.homeParticipant.name} vs ${match.awayParticipant.name}`,

                description:
                  match.status === "in_progress" && match.tableNumber > 0
                    ? `${match.tableNumber}번 테이블 · ${match.bestOf}판 경기`
                    : `${match.bestOf}판 경기`,

                canCancelResult: match.resultStatus === "confirmed",
                resultLines: [
                  match.resultStatus === "confirmed"
                    ? `${match.homeParticipant.name} ${match.homeScore} : ${match.awayScore} ${match.awayParticipant.name} · 확정`
                    : match.resultStatus === "disputed"
                      ? `${match.homeParticipant.name} vs ${match.awayParticipant.name} · 입력 불일치`
                      : match.submissionCount === 1
                        ? `${match.homeParticipant.name} vs ${match.awayParticipant.name} · 상대 입력 대기`
                        : `${match.homeParticipant.name} vs ${match.awayParticipant.name} · 결과 미입력`,
                ],

                hasDisputedResult: match.resultStatus === "disputed",
              })),
            ),
          );
        } else {
          setMatches([]);
        }

        setError("");
      } catch (caughtError) {
        setError(
          getErrorMessage(caughtError, "경기 현황을 불러오지 못했습니다."),
        );
      } finally {
        if (showLoading) {
          setIsLoading(false);
        }
      }
    },
    [setting],
  );

  useEffect(() => {
    const initialLoadId = window.setTimeout(() => {
      void loadMatches(true);
    }, 0);

    const intervalId = window.setInterval(() => {
      void loadMatches(false);
    }, MATCH_MONITOR_REFRESH_INTERVAL_MS);

    return () => {
      window.clearTimeout(initialLoadId);
      window.clearInterval(intervalId);
    };
  }, [loadMatches]);

  const summary = useMemo(() => {
    return {
      total: matches.length,
      ready: matches.filter(
        (match) => match.status === "ready" || match.status === "scheduled",
      ).length,
      inProgress: matches.filter((match) => match.status === "in_progress")
        .length,
      completed: matches.filter((match) => match.status === "completed").length,
    };
  }, [matches]);

  const visibleMatches = useMemo(() => {
    if (activeFilter === "all") {
      return matches;
    }

    if (activeFilter === "waiting") {
      return matches.filter(
        (match) =>
          match.status === "scheduled" || match.status === "ready",
      );
    }

    return matches.filter((match) => match.status === activeFilter);
  }, [activeFilter, matches]);

  const handleCancelResult = async () => {
    if (!setting || !cancelTarget) {
      return;
    }

    const normalizedReason = cancelReason.trim();

    if (!normalizedReason) {
      setError("결과 취소 사유를 입력해 주세요.");
      return;
    }

    setWorkingMatchId(cancelTarget.id);
    setError("");
    setMessage("");

    try {
      const input = {
        expectedVersion: cancelTarget.version,
        reason: normalizedReason,
      };

      if (setting.competition_type === "team_league") {
        await cancelTeamMatchResult(cancelTarget.id, input);
      } else {
        await cancelIndividualMatchResult(cancelTarget.id, input);
      }

      setMessage(
        `${cancelTarget.title} 결과를 취소했습니다. 참가자가 결과를 다시 입력할 수 있습니다.`,
      );

      setCancelTarget(null);
      setCancelReason("");

      await loadMatches(false);
    } catch (caughtError) {
      setError(
        getErrorMessage(caughtError, "경기 결과를 취소하지 못했습니다."),
      );

      await loadMatches(false);
    } finally {
      setWorkingMatchId("");
    }
  };

  if (!setting) {
    return (
      <section className={styles.panel}>
        <h2>경기 진행</h2>
        <p>게임 설정을 먼저 저장해 주세요.</p>
      </section>
    );
  }

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div>
          <h2>경기 시작 및 모니터링</h2>
          <p>경기 상태는 5초마다 자동으로 갱신됩니다.</p>
        </div>

        <button
          type="button"
          className={styles.refreshButton}
          disabled={isLoading}
          onClick={() => {
            void loadMatches(true);
          }}
        >
          <RefreshCw size={17} aria-hidden="true" />
          새로고침
        </button>
      </header>

      <div className={styles.summary}>
        <button
          type="button"
          className={`${styles.summaryItem} ${
            activeFilter === "all" ? styles.summaryItemActive : ""
          }`}
          aria-pressed={activeFilter === "all"}
          onClick={() => setActiveFilter("all")}
        >
          <span>전체</span>
          <strong>{summary.total}</strong>
        </button>

        <button
          type="button"
          className={`${styles.summaryItem} ${
            activeFilter === "waiting" ? styles.summaryItemActive : ""
          }`}
          aria-pressed={activeFilter === "waiting"}
          onClick={() => setActiveFilter("waiting")}
        >
          <span>대기</span>
          <strong>{summary.ready}</strong>
        </button>

        <button
          type="button"
          className={`${styles.summaryItem} ${
            activeFilter === "in_progress" ? styles.summaryItemActive : ""
          }`}
          aria-pressed={activeFilter === "in_progress"}
          onClick={() => setActiveFilter("in_progress")}
        >
          <span>진행 중</span>
          <strong>{summary.inProgress}</strong>
        </button>

        <button
          type="button"
          className={`${styles.summaryItem} ${
            activeFilter === "completed" ? styles.summaryItemActive : ""
          }`}
          aria-pressed={activeFilter === "completed"}
          onClick={() => setActiveFilter("completed")}
        >
          <span>완료</span>
          <strong>{summary.completed}</strong>
        </button>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {message && (
        <p className={styles.success} role="status">
          {message}
        </p>
      )}

      {isLoading && matches.length === 0 ? (
        <div className={styles.empty}>
          <Loader2 className={styles.spinner} size={24} aria-hidden="true" />
          경기 현황을 불러오는 중입니다…
        </div>
      ) : matches.length === 0 ? (
        <div className={styles.empty}>저장된 대진이 없습니다.</div>
      ) : (
        <div className={styles.matchList}>
          {visibleMatches.map((match) => (
            <article key={match.id} className={styles.matchCard}>
              <header className={styles.matchCardHeader}>
                <div className={styles.order}>
                  <span>경기</span>
                  <strong>{match.sortOrder}</strong>
                </div>

                <div className={styles.matchContent}>
                  <small>{match.round}라운드</small>
                  <strong>{match.title}</strong>
                </div>

                <span
                  className={`${styles.status} ${
                    match.hasDisputedResult
                      ? styles.status_disputed
                      : styles[`status_${match.status}`]
                  }`}
                >
                  {match.hasDisputedResult
                    ? "결과 확인 필요"
                    : STATUS_LABELS[match.status]}
                </span>
              </header>

              <div className={styles.matchDetails}>
                <span className={styles.matchDescription}>
                  {match.description}
                </span>

                {match.resultLines.length > 0 && (
                  <div className={styles.resultLines}>
                    {match.resultLines.map((resultLine, index) => (
                      <span
                        key={`${match.id}-result-${index}`}
                        className={
                          resultLine.includes("입력 불일치")
                            ? styles.resultDisputed
                            : styles.resultLine
                        }
                      >
                        {resultLine}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {match.canCancelResult && (
                <div className={styles.matchActions}>
                  <button
                    type="button"
                    className={styles.cancelButton}
                    disabled={Boolean(workingMatchId)}
                    onClick={() => {
                      setError("");
                      setCancelReason("");

                      setCancelTarget({
                        id: match.id,
                        title: match.title,
                        version: match.version,
                      });
                    }}
                  >
                    <RotateCcw size={17} aria-hidden="true" />
                    결과 취소
                  </button>
                </div>
              )}
            </article>
          ))}

          {visibleMatches.length === 0 && (
            <div className={styles.filteredEmpty}>
              선택한 상태의 경기가 없습니다.
            </div>
          )}
        </div>
      )}
      {cancelTarget && (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !workingMatchId) {
              setCancelTarget(null);
              setCancelReason("");
            }
          }}
        >
          <section
            className={styles.cancelModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-result-title"
          >
            <header>
              <div>
                <span>경기 결과 취소</span>

                <h3 id="cancel-result-title">{cancelTarget.title}</h3>
              </div>

              <button
                type="button"
                className={styles.modalCloseButton}
                disabled={Boolean(workingMatchId)}
                onClick={() => {
                  setCancelTarget(null);
                  setCancelReason("");
                }}
                aria-label="결과 취소 창 닫기"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </header>

            <div className={styles.cancelWarning}>
              <strong>확정된 경기 결과를 취소하시겠습니까?</strong>

              <p>
                저장된 결과가 삭제됩니다. 개인 단식 경기는 출전자와 빈
                테이블 상태에 따라 다시 배정됩니다.
              </p>
            </div>

            <label className={styles.reasonField}>
              <span>취소 사유</span>

              <textarea
                value={cancelReason}
                maxLength={500}
                rows={4}
                disabled={Boolean(workingMatchId)}
                placeholder="예: 점수가 잘못 입력되어 결과를 다시 입력합니다."
                onChange={(event) => {
                  setCancelReason(event.target.value);
                }}
              />

              <small>{cancelReason.length}/500</small>
            </label>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancelButton}
                disabled={Boolean(workingMatchId)}
                onClick={() => {
                  setCancelTarget(null);
                  setCancelReason("");
                }}
              >
                돌아가기
              </button>

              <button
                type="button"
                className={styles.confirmCancelButton}
                disabled={Boolean(workingMatchId) || !cancelReason.trim()}
                onClick={() => {
                  void handleCancelResult();
                }}
              >
                {workingMatchId === cancelTarget.id ? (
                  <Loader2
                    className={styles.spinner}
                    size={17}
                    aria-hidden="true"
                  />
                ) : (
                  <RotateCcw size={17} aria-hidden="true" />
                )}
                결과 취소 확정
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
