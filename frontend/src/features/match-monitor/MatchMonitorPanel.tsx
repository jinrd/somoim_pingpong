import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ClipboardCheck,
  Loader2,
  RefreshCw,
  RotateCcw,
  X,
} from "lucide-react";

import { ClientResponseError } from "pocketbase";

import type { EventGameSetting } from "../game-settings/types";

import {
  cancelIndividualMatchResult,
  cancelTeamMatchResult,
  confirmIndividualMatchResult,
  confirmTeamGameResult,
  getIndividualSchedule,
  getTeamSchedule,
  type MatchResultStatus,
  type TeamMatchStatus,
} from "../match-schedule/api";

import { MATCH_MONITOR_REFRESH_INTERVAL_MS } from "./constants";

import styles from "./MatchMonitorPanel.module.css";

interface Props {
  setting: EventGameSetting | null;
  onEventStatusChanged?: () => void | Promise<void>;
}

type ResultTargetType = "team_game" | "individual_match";

interface MonitorResult {
  id: string;
  type: ResultTargetType;
  title: string;
  homeName: string;
  awayName: string;
  bestOf: number;
  version: number;
  status: TeamMatchStatus;
  resultStatus: MatchResultStatus;
  homeScore: number;
  awayScore: number;
  submissionCount: number;
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
  results: MonitorResult[];
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

const getRequiredWins = (bestOf: number): number => {
  return Math.floor(bestOf / 2) + 1;
};

const getResultText = (result: MonitorResult): string => {
  if (result.resultStatus === "confirmed") {
    return `${result.homeName} ${result.homeScore} : ${result.awayScore} ${result.awayName} · 확정`;
  }

  if (result.resultStatus === "disputed") {
    return `${result.homeName} vs ${result.awayName} · 입력 불일치`;
  }

  if (result.submissionCount === 1) {
    return `${result.homeName} vs ${result.awayName} · 상대 입력 대기`;
  }

  return `${result.homeName} vs ${result.awayName} · 결과 미입력`;
};

const canAdminConfirm = (result: MonitorResult): boolean => {
  return (
    result.status === "in_progress" &&
    result.resultStatus !== "confirmed"
  );
};

export default function MatchMonitorPanel({
  setting,
  onEventStatusChanged,
}: Props) {
  const [matches, setMatches] = useState<MonitorMatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [workingMatchId, setWorkingMatchId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [resultTarget, setResultTarget] = useState<MonitorResult | null>(null);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [resultReason, setResultReason] = useState("");
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
                    ? "양 팀 라인업 확정"
                    : "라인업 확정 필요",
                results: match.games.map((game) => {
                  const typeLabel =
                    game.matchType === "singles" ? "단식" : "복식";
                  const homePlayers =
                    game.homePlayers.map((player) => player.name).join("·") ||
                    match.homeTeam.name;
                  const awayPlayers =
                    game.awayPlayers.map((player) => player.name).join("·") ||
                    match.awayTeam.name;

                  return {
                    id: game.id,
                    type: "team_game" as const,
                    title: `${game.sequence}. ${typeLabel}`,
                    homeName: homePlayers,
                    awayName: awayPlayers,
                    bestOf: game.bestOf,
                    version: game.version,
                    status: game.status,
                    resultStatus: game.resultStatus,
                    homeScore: game.homeScore,
                    awayScore: game.awayScore,
                    submissionCount: game.submissionCount,
                  };
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
                results: [
                  {
                    id: match.id,
                    type: "individual_match" as const,
                    title: "개인 단식",
                    homeName: match.homeParticipant.name,
                    awayName: match.awayParticipant.name,
                    bestOf: match.bestOf,
                    version: match.version,
                    status: match.status,
                    resultStatus: match.resultStatus,
                    homeScore: match.homeScore,
                    awayScore: match.awayScore,
                    submissionCount: match.submissionCount,
                  },
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

  const openResultModal = (target: MonitorResult) => {
    const requiredWins = getRequiredWins(target.bestOf);

    setError("");
    setResultReason("");
    setHomeScore(requiredWins);
    setAwayScore(0);
    setResultTarget(target);
  };

  const handleConfirmResult = async () => {
    if (!resultTarget) {
      return;
    }

    const reason = resultReason.trim();
    const requiredWins = getRequiredWins(resultTarget.bestOf);
    const isValidScore =
      (homeScore === requiredWins && awayScore < requiredWins) ||
      (awayScore === requiredWins && homeScore < requiredWins);

    if (!isValidScore) {
      setError(
        `${resultTarget.bestOf}판 경기의 승자는 ${requiredWins}승이어야 합니다.`,
      );
      return;
    }

    if (!reason) {
      setError("운영진 입력 사유를 입력해 주세요.");
      return;
    }

    setWorkingMatchId(resultTarget.id);
    setError("");
    setMessage("");

    try {
      const input = {
        expectedVersion: resultTarget.version,
        homeScore,
        awayScore,
        reason,
      };

      if (resultTarget.type === "team_game") {
        await confirmTeamGameResult(resultTarget.id, input);
      } else {
        await confirmIndividualMatchResult(resultTarget.id, input);
      }

      setMessage(`${resultTarget.title} 결과를 운영진 입력으로 확정했습니다.`);
      setResultTarget(null);
      setResultReason("");
      await loadMatches(false);

      try {
        await onEventStatusChanged?.();
      } catch {
        // 회차 상태는 주기적 갱신에서도 다시 불러옵니다.
      }
    } catch (caughtError) {
      setError(
        getErrorMessage(caughtError, "경기 결과를 확정하지 못했습니다."),
      );
      await loadMatches(false);
    } finally {
      setWorkingMatchId("");
    }
  };

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

      try {
        await onEventStatusChanged?.();
      } catch {
        // 회차 상태는 주기적 갱신에서도 다시 불러옵니다.
      }
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

                <div className={styles.resultLines}>
                  {match.results.map((result) => (
                    <div
                      key={result.id}
                      className={
                        result.resultStatus === "disputed"
                          ? styles.resultDisputed
                          : styles.resultLine
                      }
                    >
                      <div className={styles.resultContent}>
                        <strong>{result.title}</strong>
                        <span>{getResultText(result)}</span>
                      </div>

                      {canAdminConfirm(result) && (
                        <button
                          type="button"
                          className={styles.inputResultButton}
                          disabled={Boolean(workingMatchId)}
                          onClick={() => openResultModal(result)}
                        >
                          <ClipboardCheck size={16} aria-hidden="true" />
                          {result.resultStatus === "disputed"
                            ? "점수 확인"
                            : "대신 입력"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
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

      {resultTarget && (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !workingMatchId) {
              setResultTarget(null);
              setResultReason("");
            }
          }}
        >
          <section
            className={styles.cancelModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-result-title"
          >
            <header>
              <div>
                <span className={styles.resultModalEyebrow}>
                  운영진 결과 입력
                </span>
                <h3 id="admin-result-title">{resultTarget.title}</h3>
              </div>

              <button
                type="button"
                className={styles.modalCloseButton}
                disabled={Boolean(workingMatchId)}
                onClick={() => {
                  setResultTarget(null);
                  setResultReason("");
                }}
                aria-label="운영진 결과 입력 창 닫기"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </header>

            <p className={styles.resultHelp}>
              참가자가 입력하지 못한 최종 점수를 운영진 권한으로 바로
              확정합니다.
            </p>

            <div className={styles.scoreEditor}>
              <label>
                <span>{resultTarget.homeName}</span>
                <select
                  value={homeScore}
                  disabled={Boolean(workingMatchId)}
                  onChange={(event) => setHomeScore(Number(event.target.value))}
                >
                  {Array.from(
                    { length: getRequiredWins(resultTarget.bestOf) + 1 },
                    (_, score) => (
                      <option key={score} value={score}>
                        {score}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <strong>:</strong>

              <label>
                <span>{resultTarget.awayName}</span>
                <select
                  value={awayScore}
                  disabled={Boolean(workingMatchId)}
                  onChange={(event) => setAwayScore(Number(event.target.value))}
                >
                  {Array.from(
                    { length: getRequiredWins(resultTarget.bestOf) + 1 },
                    (_, score) => (
                      <option key={score} value={score}>
                        {score}
                      </option>
                    ),
                  )}
                </select>
              </label>
            </div>

            <p className={styles.scoreRule}>
              {resultTarget.bestOf}판 경기 · 먼저{" "}
              {getRequiredWins(resultTarget.bestOf)}승
            </p>

            <label className={styles.reasonField}>
              <span>입력 사유</span>
              <textarea
                value={resultReason}
                maxLength={500}
                rows={3}
                disabled={Boolean(workingMatchId)}
                placeholder="예: 참가자가 현장에서 결과 입력을 요청했습니다."
                onChange={(event) => setResultReason(event.target.value)}
              />
              <small>{resultReason.length}/500</small>
            </label>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancelButton}
                disabled={Boolean(workingMatchId)}
                onClick={() => {
                  setResultTarget(null);
                  setResultReason("");
                }}
              >
                돌아가기
              </button>

              <button
                type="button"
                className={styles.confirmResultButton}
                disabled={Boolean(workingMatchId) || !resultReason.trim()}
                onClick={() => void handleConfirmResult()}
              >
                {workingMatchId === resultTarget.id ? (
                  <Loader2
                    className={styles.spinner}
                    size={17}
                    aria-hidden="true"
                  />
                ) : (
                  <ClipboardCheck size={17} aria-hidden="true" />
                )}
                결과 확정
              </button>
            </div>
          </section>
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
                onChange={(event) => setCancelReason(event.target.value)}
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
                onClick={() => void handleCancelResult()}
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
