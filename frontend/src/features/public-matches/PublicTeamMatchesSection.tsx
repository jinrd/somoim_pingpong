import { Fragment, useCallback, useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";

import PublicTeamSummary from "./PublicTeamSummary";

import { getMyTeamMatches, getPublicTeamMatchContext } from "./api";
import type {
  PublicParticipantMatchesResponse,
  PublicTeamMatchContext,
} from "./types";

import {
  getPublicMatchPriority,
  getPublicMatchStatusLabel,
} from "./publicMatchStatus";

import styles from "./PublicMatchesSection.module.css";
import PublicMatchResultForm from "../match-result/PublicMatchResultForm";
import usePublicMatchPolling from "./usePublicMatchPolling";
interface Props {
  responseToken: string;
}
import { PUBLIC_MATCH_REFRESH_INTERVAL_MS } from "./constants";
import { getPublicFeatureErrorMessage } from "./publicErrorUtils";
const getMatchTypeLabel = (matchType: "singles" | "doubles"): string => {
  return matchType === "singles" ? "단식" : "복식";
};

export default function PublicTeamMatchesSection({ responseToken }: Props) {
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

  usePublicMatchPolling({
    refresh: reloadMatches,
    intervalMs: PUBLIC_MATCH_REFRESH_INTERVAL_MS,
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
      <section className={styles.section}>
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

  return (
    <section className={styles.section}>
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
      ) : (
        <>
          <PublicTeamSummary
            team={matchResponse.team}
            members={matchResponse.members ?? []}
          />

          {matchResponse.matches.length === 0 ? (
            <p className={styles.empty}>아직 저장된 팀 경기가 없습니다.</p>
          ) : (
            <div className={styles.matchList}>
              {orderedMatches.map((match) => (
                <Fragment key={match.id}>
                  <button
                    type="button"
                    className={
                      context?.match.id === match.id
                        ? styles.matchButtonActive
                        : styles.matchButton
                    }
                    aria-expanded={context?.match.id === match.id}
                    aria-controls={`team-result-${match.id}`}
                    disabled={isOpening}
                    onClick={() => {
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
                      {matchResponse.team?.name} VS {match.opponentTeam.name}
                    </strong>

                    <small>
                      경기 상태: {getPublicMatchStatusLabel(match.status)}
                    </small>

                    <small>
                      {match.status === "in_progress"
                        ? "결과 입력 가능"
                        : match.status === "completed"
                          ? "결과 확인"
                          : "경기 정보 확인"}
                    </small>
                  </button>

                  {context?.match.id === match.id && !isOpening && (
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
              ))}
            </div>
          )}
        </>
      )}

      {isOpening && (
        <p className={styles.empty}>경기 정보를 불러오는 중입니다…</p>
      )}
    </section>
  );
}
