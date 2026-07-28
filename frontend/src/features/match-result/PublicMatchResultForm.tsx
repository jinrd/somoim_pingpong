import { useCallback, useEffect, useState } from "react";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Save,
} from "lucide-react";

import { ClientResponseError } from "pocketbase";

import {
  getIndividualMatchResultContext,
  getTeamGameResultContext,
  submitIndividualMatchResult,
  submitTeamGameResult,
} from "./api";

import type { MatchResultTargetType, PublicMatchResultContext } from "./types";

import styles from "./PublicMatchResultForm.module.css";

interface PublicMatchResultFormProps {
  targetType: MatchResultTargetType;
  targetId: string;
  responseToken: string;
}

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
}: PublicMatchResultFormProps) {
  const [context, setContext] = useState<PublicMatchResultContext | null>(null);

  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const applyContext = useCallback((nextContext: PublicMatchResultContext) => {
    setContext(nextContext);

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
  }, []);

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

  const handleSubmit = async () => {
    if (!context) {
      return;
    }

    const requiredWins = context.requiredWins;

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
        responseToken,
        expectedVersion: context.ownSubmission?.version ?? 0,
        homeScore,
        awayScore,
      };

      const result =
        targetType === "team_game"
          ? await submitTeamGameResult(targetId, input)
          : await submitIndividualMatchResult(targetId, input);

      applyContext(result);

      if (result.resultStatus === "confirmed") {
        setMessage("양측의 결과가 일치하여 경기 결과가 확정됐습니다.");
      } else if (result.resultStatus === "disputed") {
        setMessage(
          "상대편이 입력한 결과와 일치하지 않습니다. 점수를 확인하고 다시 제출해 주세요.",
        );
      } else {
        setMessage("결과를 제출했습니다. 상대편의 확인을 기다리고 있습니다.");
      }
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

  return (
    <section className={styles.container}>
      <header className={styles.header}>
        <div>
          <strong>경기 결과</strong>

          <span>
            {context.bestOf}판 {context.requiredWins}선승
          </span>
        </div>

        <button
          type="button"
          className={styles.refreshButton}
          disabled={isSaving || isLoading}
          onClick={() => {
            void loadContext();
          }}
          aria-label="경기 결과 새로고침"
        >
          <RefreshCw size={16} aria-hidden="true" />
        </button>
      </header>

      <div className={styles.sideNotice}>
        내 진영:{" "}
        <strong>
          {context.side === "home" ? context.home.label : context.away.label}
        </strong>
      </div>

      <div className={styles.scoreBoard}>
        <div className={styles.competitor}>
          <strong>{context.home.label}</strong>
          <small>{getPlayersLabel(context.home.players)}</small>
        </div>

        <div className={styles.scoreInputs}>
          {isConfirmed ? (
            <>
              <strong>{context.result?.homeScore}</strong>
              <span>:</span>
              <strong>{context.result?.awayScore}</strong>
            </>
          ) : (
            <>
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

              <span>:</span>

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
            </>
          )}
        </div>

        <div className={styles.competitor}>
          <strong>{context.away.label}</strong>
          <small>{getPlayersLabel(context.away.players)}</small>
        </div>
      </div>

      {context.resultStatus === "confirmed" && (
        <div className={styles.confirmed} role="status">
          <CheckCircle2 size={18} aria-hidden="true" />
          양측 결과가 일치하여 최종 확정됐습니다.
        </div>
      )}

      {context.resultStatus === "disputed" && (
        <div className={styles.disputed} role="alert">
          <AlertTriangle size={18} aria-hidden="true" />

          <div>
            <strong>입력 결과가 일치하지 않습니다.</strong>
            <span>양측이 점수를 다시 확인한 후 수정해 주세요.</span>
          </div>
        </div>
      )}

      {context.resultStatus === "pending" && context.ownSubmission && (
        <div className={styles.waiting}>
          <Clock3 size={17} aria-hidden="true" />

          {context.otherSideSubmitted
            ? "양측 결과를 확인하고 있습니다."
            : "내 결과를 제출했습니다. 상대편 입력을 기다리고 있습니다."}
        </div>
      )}

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
          disabled={isSaving || isLoading}
          onClick={() => {
            void handleSubmit();
          }}
        >
          <Save size={17} aria-hidden="true" />

          {isSaving
            ? "결과 저장 중…"
            : context.ownSubmission
              ? "내 결과 수정"
              : "결과 제출"}
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
