import { useCallback, useEffect, useRef, useState } from "react";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Save,
  X,
} from "lucide-react";

import { ClientResponseError } from "pocketbase";

import {
  getIndividualMatchResultContext,
  getTeamGameResultContext,
  submitIndividualMatchResult,
  submitTeamGameResult,
} from "./api";

import type { PublicMatchResultContext } from "./types";

import { getBestOfLabel } from "../match-schedule/matchFormatUtils";

import styles from "./PublicMatchResultForm.module.css";

interface PublicMatchResultFormProps {
  targetType: "team_game" | "individual_match";
  targetId: string;
  responseToken: string;
  onResultUpdated?: () => void | Promise<void>;
  pollingEnabled?: boolean;
  showHeader?: boolean;
  onClose?: () => void;
}

const RESULT_REFRESH_INTERVAL_MS = 5_000;

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof ClientResponseError) {
    if (error.isAbort) {
      return "";
    }

    return error.response?.message || error.message || fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
};

const getPlayersLabel = (
  players: PublicMatchResultContext["home"]["players"],
): string => {
  if (players.length === 0) {
    return "출전 선수 미정";
  }

  return players.map((player) => player.name).join(", ");
};

export default function PublicMatchResultForm({
  targetType,
  targetId,
  responseToken,
  onResultUpdated,
  pollingEnabled = true,
  showHeader = false,
  onClose,
}: PublicMatchResultFormProps) {
  const [context, setContext] = useState<PublicMatchResultContext | null>(null);

  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [participantIds, setParticipantIds] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const contextRef = useRef<PublicMatchResultContext | null>(null);

  const applyContext = useCallback(
    (nextContext: PublicMatchResultContext, syncScores = true) => {
      contextRef.current = nextContext;
      setContext(nextContext);

      if (syncScores && nextContext.targetType === "team_game") {
        const ownSide =
          nextContext.side === "home" ? nextContext.home : nextContext.away;

        setParticipantIds(
          ownSide.players.map((player) => player.participantId),
        );
      }

      if (!syncScores) {
        return;
      }

      if (nextContext.result) {
        setHomeScore(nextContext.result.homeScore);
        setAwayScore(nextContext.result.awayScore);
        return;
      }

      if (nextContext.ownSubmission) {
        setHomeScore(nextContext.ownSubmission.homeScore);
        setAwayScore(nextContext.ownSubmission.awayScore);
        return;
      }

      setHomeScore(0);
      setAwayScore(0);
    },
    [],
  );

  const loadContext = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const result =
        targetType === "team_game"
          ? await getTeamGameResultContext(targetId, responseToken)
          : await getIndividualMatchResultContext(targetId, responseToken);

      applyContext(result);
    } catch (caughtError) {
      const errorMessage = getErrorMessage(
        caughtError,
        "경기 결과 정보를 불러오지 못했습니다.",
      );

      if (errorMessage) {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  }, [applyContext, responseToken, targetId, targetType]);

  useEffect(() => {
    const loadId = window.setTimeout(() => {
      void loadContext();
    }, 0);

    return () => {
      window.clearTimeout(loadId);
    };
  }, [loadContext]);

  useEffect(() => {
    if (!pollingEnabled) {
      return;
    }

    let cancelled = false;
    let isRequesting = false;

    const refreshContext = async () => {
      if (cancelled || isRequesting || document.visibilityState !== "visible") {
        return;
      }

      isRequesting = true;

      try {
        const nextContext =
          targetType === "team_game"
            ? await getTeamGameResultContext(targetId, responseToken)
            : await getIndividualMatchResultContext(targetId, responseToken);

        if (cancelled) {
          return;
        }

        const currentContext = contextRef.current;

        const shouldSyncScores =
          !currentContext ||
          currentContext.status !== nextContext.status ||
          currentContext.resultStatus !== nextContext.resultStatus ||
          currentContext.result?.confirmedAt !==
            nextContext.result?.confirmedAt ||
          currentContext.ownSubmission?.version !==
            nextContext.ownSubmission?.version;

        applyContext(nextContext, shouldSyncScores);
      } catch {
        /*
         * 자동 갱신 실패 시 현재 화면과 사용자가 선택 중인 점수를 유지합니다.
         * 사용자가 새로고침 버튼을 누르면 상세 오류를 표시합니다.
         */
      } finally {
        isRequesting = false;
      }
    };

    const intervalId = window.setInterval(() => {
      void refreshContext();
    }, RESULT_REFRESH_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshContext();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [applyContext, pollingEnabled, responseToken, targetId, targetType]);

  const handleSubmit = async () => {
    if (!context) {
      return;
    }

    const requiredWins = context.requiredWins;

    if (
      targetType === "team_game" &&
      participantIds.length !== context.requiredPlayerCount
    ) {
      setError(
        `실제 출전 선수 ${context.requiredPlayerCount}명을 선택해 주세요.`,
      );
      return;
    }

    const homeWon = homeScore === requiredWins && awayScore < requiredWins;

    const awayWon = awayScore === requiredWins && homeScore < requiredWins;

    if (!homeWon && !awayWon) {
      setError(
        `승자는 반드시 ${requiredWins}승이어야 하며 패자는 ${requiredWins}승보다 적어야 합니다.`,
      );
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const input = {
        requestId: crypto.randomUUID(),
        responseToken,
        expectedVersion: context.ownSubmission?.version ?? 0,
        homeScore,
        awayScore,
        participantIds: targetType === "team_game" ? participantIds : undefined,
      };

      const result =
        targetType === "team_game"
          ? await submitTeamGameResult(targetId, input)
          : await submitIndividualMatchResult(targetId, input);

      applyContext(result);
      setMessage("");
      await onResultUpdated?.();
    } catch (caughtError) {
      const errorMessage = getErrorMessage(
        caughtError,
        "경기 결과를 저장하지 못했습니다.",
      );

      if (errorMessage) {
        setError(errorMessage);
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && !context) {
    return (
      <div className={styles.state}>
        <Clock3 size={17} aria-hidden="true" />
        경기 결과를 확인하는 중입니다…
      </div>
    );
  }

  if (!context) {
    return (
      <div className={styles.error} role="alert">
        <span>{error || "경기 결과를 확인할 수 없습니다."}</span>

        <button
          type="button"
          onClick={() => {
            void loadContext();
          }}
        >
          다시 확인
        </button>
      </div>
    );
  }

  const scoreOptions = Array.from(
    { length: context.requiredWins + 1 },
    (_, index) => index,
  );

  const isConfirmed =
    context.resultStatus === "confirmed" && context.result !== null;

  const canSubmit = context.status === "in_progress" && !isConfirmed;
  const ownSide = context.side === "home" ? context.home : context.away;

  const hasValidPlayers =
    targetType !== "team_game" ||
    participantIds.length === context.requiredPlayerCount;

  const hasValidScore =
    (homeScore === context.requiredWins && awayScore < context.requiredWins) ||
    (awayScore === context.requiredWins && homeScore < context.requiredWins);

  const canSubmitResult = canSubmit && hasValidPlayers && hasValidScore;

  const resultTitle =
    context.resultStatus === "confirmed"
      ? "결과 일치"
      : context.resultStatus === "disputed"
        ? "결과 불일치"
        : "점수 입력";

  const resultTitleClassName =
    context.resultStatus === "confirmed"
      ? styles.resultTitleMatched
      : context.resultStatus === "disputed"
        ? styles.resultTitleMismatch
        : "";

  return (
    <section className={styles.container}>
      {showHeader && (
        <header className={styles.header}>
          <div className={styles.headerMeta}>
            <strong className={styles.matchType}>개인 단식</strong>
            <span>{getBestOfLabel(context.bestOf)}</span>
          </div>

          <strong className={resultTitleClassName}>
            {context.resultStatus === "confirmed" && (
              <CheckCircle2 size={16} aria-hidden="true" />
            )}
            {context.resultStatus === "disputed" && (
              <AlertTriangle size={16} aria-hidden="true" />
            )}
            {resultTitle}
          </strong>

          {onClose && (
            <button
              type="button"
              className={styles.closeButton}
              aria-label="경기 결과 닫기"
              onClick={onClose}
            >
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </header>
      )}

      <div className={styles.sideNotice}>
        내 진영:{" "}
        <strong>
          {context.side === "home" ? context.home.label : context.away.label}
        </strong>
      </div>
      <div className={styles.resultEntryStack}>
        {targetType === "team_game" && canSubmit && (
          <fieldset className={styles.playerSelection}>
            <legend>
              실제 출전 선수 {participantIds.length}/
              {context.requiredPlayerCount}
            </legend>

            <div className={styles.playerOptions}>
              {(ownSide.members ?? []).map((member) => {
                const selected = participantIds.includes(member.participantId);

                return (
                  <button
                    key={member.participantId}
                    type="button"
                    className={
                      selected
                        ? styles.playerOptionSelected
                        : styles.playerOption
                    }
                    disabled={isSaving || isLoading}
                    aria-pressed={selected}
                    onClick={() => {
                      setParticipantIds((current) => {
                        if (current.includes(member.participantId)) {
                          return current.filter(
                            (participantId) =>
                              participantId !== member.participantId,
                          );
                        }

                        if (current.length >= context.requiredPlayerCount) {
                          return [...current.slice(1), member.participantId];
                        }

                        return [...current, member.participantId];
                      });
                      setError("");
                    }}
                  >
                    {member.name}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}
        <div className={styles.scoreBoard}>
          <div
            className={`${styles.competitor} ${
              context.side === "home" ? styles.competitorMine : ""
            }`}
          >
            <span className={styles.sideBadge}>
              {context.side === "home" ? "내 팀" : "상대"}
            </span>

            <strong>{context.home.label}</strong>

            {targetType === "team_game" && (
              <small>({getPlayersLabel(context.home.players)})</small>
            )}
          </div>

          <div className={styles.scoreInputs}>
            {isConfirmed ? (
              <>
                <strong>{context.result?.homeScore}</strong>
                <span className={styles.scoreSeparator}>:</span>
                <strong>{context.result?.awayScore}</strong>
              </>
            ) : (
              <>
                <div className={styles.scoreSelectorWrapper}>
                  <select
                    value={homeScore}
                    disabled={!canSubmit || isSaving || isLoading}
                    aria-label={`${context.home.label} 점수`}
                    onChange={(event) => {
                      setHomeScore(Number(event.currentTarget.value));
                      setError("");
                      setMessage("");
                    }}
                  >
                    {scoreOptions.map((score) => (
                      <option key={score} value={score}>
                        {score}
                      </option>
                    ))}
                  </select>

                  <span className={styles.scoreSeparator}>:</span>

                  <select
                    value={awayScore}
                    disabled={!canSubmit || isSaving || isLoading}
                    aria-label={`${context.away.label} 점수`}
                    onChange={(event) => {
                      setAwayScore(Number(event.currentTarget.value));
                      setError("");
                      setMessage("");
                    }}
                  >
                    {scoreOptions.map((score) => (
                      <option key={score} value={score}>
                        {score}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>

          <div
            className={`${styles.competitor} ${
              context.side === "away" ? styles.competitorMine : ""
            }`}
          >
            <span className={styles.sideBadge}>
              {context.side === "away" ? "내 팀" : "상대"}
            </span>

            <strong>{context.away.label}</strong>

            {targetType === "team_game" && (
              <small>({getPlayersLabel(context.away.players)})</small>
            )}
          </div>
        </div>
      </div>



      {error && (
        <p className={styles.errorMessage} role="alert">
          {error}
        </p>
      )}

      {message && (
        <p className={styles.message} role="status">
          {message}
        </p>
      )}

      {canSubmit && (
        <button
          type="button"
          className={styles.submitButton}
          disabled={isSaving || isLoading || !canSubmitResult}
          onClick={() => {
            void handleSubmit();
          }}
        >
          <Save size={17} aria-hidden="true" />

          {isSaving
            ? "결과 저장 중…"
            : context.ownSubmission
              ? "점수 수정"
              : "점수 제출"}
        </button>
      )}

      {!canSubmit && !isConfirmed && (
        <p className={styles.unavailable}>
          현재 결과를 입력할 수 없는 경기입니다.
        </p>
      )}
    </section>
  );
}
