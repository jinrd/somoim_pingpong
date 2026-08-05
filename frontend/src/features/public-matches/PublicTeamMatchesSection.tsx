import { Fragment, useCallback, useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";

import PublicMatchGroup from "./PublicMatchGroup";

import { getMyTeamMatches, getPublicTeamMatchContext } from "./api";
import type {
  PublicParticipantMatch,
  PublicParticipantMatchesResponse,
  PublicTeamMatchContext,
} from "./types";

import {
  getPublicMatchPriority,
  getPublicMatchStatusLabel,
  groupPublicMatches,
  hasOpenPublicMatches,
  canOpenPublicMatchResult,
} from "./publicMatchStatus";

import styles from "./PublicMatchesSection.module.css";
import PublicMatchResultForm from "../match-result/PublicMatchResultForm";
import usePublicMatchPolling from "./usePublicMatchPolling";
interface PublicTeamMatchesSectionProps {
  responseToken: string;
  isActive: boolean;
}
import { PUBLIC_MATCH_REFRESH_INTERVAL_MS } from "./constants";
import { getPublicFeatureErrorMessage } from "./publicErrorUtils";
const getMatchTypeLabel = (matchType: "singles" | "doubles"): string => {
  return matchType === "singles" ? "단식" : "복식";
};

export default function PublicTeamMatchesSection({
  responseToken,
  isActive,
}: PublicTeamMatchesSectionProps) {
  const [matchResponse, setMatchResponse] =
    useState<PublicParticipantMatchesResponse | null>(null);

  const [context, setContext] = useState<PublicTeamMatchContext | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isOpening, setIsOpening] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    getMyTeamMatches(responseToken)
      .then((result) => {
        if (!cancelled) {
          setMatchResponse(result);
          setError("");
        }
      })
      .catch((caughtError) => {
        if (!cancelled) {
          setError(
            getPublicFeatureErrorMessage(
              caughtError,
              "내 경기 목록을 불러오지 못했습니다.",
            ),
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [responseToken]);

  const reloadMatches = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const result = await getMyTeamMatches(responseToken);

      setMatchResponse(result);
    } catch (caughtError) {
      setError(
        getPublicFeatureErrorMessage(
          caughtError,
          "내 경기 목록을 불러오지 못했습니다.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }, [responseToken]);

  const shouldPoll =
    isActive && hasOpenPublicMatches(matchResponse?.matches ?? []);

  usePublicMatchPolling({
    refresh: reloadMatches,
    intervalMs: PUBLIC_MATCH_REFRESH_INTERVAL_MS,
    enabled: shouldPoll,
  });

  const openMatch = async (teamMatchId: string) => {
    setIsOpening(true);
    setError("");
    setContext(null);

    try {
      const result = await getPublicTeamMatchContext(
        teamMatchId,
        responseToken,
      );

      setContext(result);
    } catch (caughtError) {
      setError(
        getPublicFeatureErrorMessage(
          caughtError,
          "경기 정보를 불러오지 못했습니다.",
        ),
      );
    } finally {
      setIsOpening(false);
    }
  };

  useEffect(() => {
    if (!context) {
      return;
    }

    const currentMatch = matchResponse?.matches.find(
      (match) => match.id === context.match.id,
    );

    if (
      !currentMatch ||
      (currentMatch.status !== "in_progress" &&
        currentMatch.status !== "completed")
    ) {
      const timeoutId = setTimeout(() => {
        setContext(null);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [context, matchResponse]);
  useEffect(() => {
    if (!context || isOpening) {
      return;
    }

    window.requestAnimationFrame(() => {
      document
        .getElementById(`team-result-${context.match.id}`)
        ?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
    });
  }, [context, isOpening]);

  if (isLoading && !matchResponse) {
    return (
      <section className={styles.section} aria-busy={isLoading || isOpening}>
        내 팀 경기 정보를 불러오는 중입니다…
      </section>
    );
  }

  const orderedMatches = matchResponse
    ? [...matchResponse.matches].sort((left, right) => {
        return (
          getPublicMatchPriority(left.status) -
            getPublicMatchPriority(right.status) ||
          left.sortOrder - right.sortOrder
        );
      })
    : [];

  const matchGroups = groupPublicMatches(orderedMatches);

  const renderMatch = (match: PublicParticipantMatch) => {
    const isOpened = context?.match.id === match.id;
    const isCurrentMatch = match.status === "in_progress";
    const canOpenResult = canOpenPublicMatchResult(match.status);

    return (
      <Fragment key={match.id}>
        <button
          type="button"
          className={
            isCurrentMatch
              ? styles.matchButtonCurrent
              : isOpened
                ? styles.matchButtonActive
                : styles.matchButton
          }
        aria-expanded={context?.match.id === match.id}
        aria-controls={`team-result-${match.id}`}
        disabled={!canOpenResult || isOpening}
        onClick={() => {
          if (!canOpenResult) {
            return;
          }

          if (context?.match.id === match.id) {
            setContext(null);
            return;
          }

          void openMatch(match.id);
        }}
      >
        <span>
          {match.round}라운드 · {match.sortOrder}번째 경기
        </span>

        <strong>
          {matchResponse?.team?.name} VS {match.opponentTeam.name}
        </strong>

        <small>
          경기 상태: {getPublicMatchStatusLabel(match.status)}
        </small>

        <small>
          {match.status === "in_progress"
            ? "결과 입력 가능"
            : match.status === "completed"
              ? "결과 확인"
              : "경기 시작 전"}
        </small>
      </button>

      {context?.match.id === match.id &&
        !isOpening &&
        canOpenResult && (
        <div
          id={`team-result-${match.id}`}
          className={styles.inlineEditor}
        >
          <header className={styles.editorHeader}>
            <div>
              <span>{context.match.round}라운드</span>

              <h3>
                {context.team.name} VS {context.opponentTeam.name}
              </h3>
            </div>

            <button
              type="button"
              className={styles.closeEditorButton}
              aria-label="경기 결과 입력 닫기"
              onClick={() => {
                setContext(null);
              }}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </header>

          <div className={styles.gameList}>
            {context.games.map((game) => (
              <article key={game.id} className={styles.gameCard}>
                <div className={styles.gameCardHeader}>
                  <div>
                    <span>
                      {game.sequence}번째 세부 경기 ·{" "}
                      {getMatchTypeLabel(game.matchType)}
                    </span>

                    <strong>{game.bestOf}판 경기</strong>
                  </div>

                  <span className={styles.gameCardAction}>
                    {game.status === "in_progress"
                      ? "입력 가능"
                      : game.status === "completed"
                        ? "결과 확인"
                        : "대기 중"}
                  </span>
                </div>

                <PublicMatchResultForm
                  targetType="team_game"
                  targetId={game.id}
                  responseToken={responseToken}
                  pollingEnabled={game.status === "in_progress"}
                  onResultUpdated={reloadMatches}
                />
              </article>
            ))}
          </div>
        </div>
      )}
    </Fragment>
    );
  };

  return (
    <section className={styles.section} aria-busy={isLoading || isOpening}>
      <header className={styles.header}>
        <div>
          <h2>내 팀 경기</h2>

          <p>경기가 시작되면 실제 출전 선수와 점수를 입력합니다.</p>
        </div>

        <button
          type="button"
          className={styles.iconButton}
          disabled={isLoading || isOpening}
          onClick={() => {
            void reloadMatches();
          }}
          aria-label="내 경기 새로고침"
        >
          <RefreshCw size={18} aria-hidden="true" />
        </button>
      </header>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {!matchResponse?.team ? (
        <p className={styles.empty}>아직 확정된 팀 편성이나 대진이 없습니다.</p>
      ) : matchResponse.matches.length === 0 ? (
        <p className={styles.empty}>아직 저장된 팀 경기가 없습니다.</p>
      ) : (
        <>
          <PublicMatchGroup
            title="진행 중"
            count={matchGroups.inProgress.length}
          >
            {matchGroups.inProgress.map(renderMatch)}
          </PublicMatchGroup>

          <PublicMatchGroup
            title="예정 경기"
            count={matchGroups.upcoming.length}
          >
            {matchGroups.upcoming.map(renderMatch)}
          </PublicMatchGroup>

          <PublicMatchGroup
            title="종료 경기"
            count={matchGroups.completed.length}
          >
            {matchGroups.completed.map(renderMatch)}
          </PublicMatchGroup>

          <PublicMatchGroup
            title="취소 경기"
            count={matchGroups.cancelled.length}
          >
            {matchGroups.cancelled.map(renderMatch)}
          </PublicMatchGroup>
        </>
      )}

      {isOpening && (
        <p className={styles.empty}>경기 정보를 불러오는 중입니다…</p>
      )}
    </section>
  );
}
