import { useCallback, useEffect, useRef, useState } from "react";

import { RefreshCw } from "lucide-react";
import { ClientResponseError } from "pocketbase";

import PublicMatchResultForm from "../match-result/PublicMatchResultForm";

import { getMyIndividualMatches } from "./api";

import type {
  PublicParticipantMatchesResponse,
  PublicTeamMatchStatus,
} from "./types";

import styles from "./PublicLineupSection.module.css";
import { PUBLIC_MATCH_REFRESH_INTERVAL_MS } from "./constants";
interface PublicIndividualLineupSectionProps {
  responseToken: string;
  onMatchStarted?: (notice: PublicIndividualMatchStartedNotice) => void;
}

export interface PublicIndividualMatchStartedNotice {
  matchId: string;
  tableNumber: number;
  opponentName: string;
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof ClientResponseError) {
    return error.response?.message || error.message || fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
};

const getStatusLabel = (status: PublicTeamMatchStatus): string => {
  const labels: Record<PublicTeamMatchStatus, string> = {
    scheduled: "대기 중",
    ready: "시작 대기",
    in_progress: "진행 중",
    completed: "경기 완료",
    cancelled: "취소",
  };

  return labels[status];
};

export default function PublicIndividualLineupSection({
  responseToken,
  onMatchStarted,
}: PublicIndividualLineupSectionProps) {
  const [matchResponse, setMatchResponse] =
    useState<PublicParticipantMatchesResponse | null>(null);

  const [openedMatchId, setOpenedMatchId] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const previousMatchStatusesRef = useRef(new Map<string, string>());

  const applyMatchResponse = useCallback(
    (result: PublicParticipantMatchesResponse) => {
      const newlyStartedMatch = result.matches.find(
        (match) =>
          match.status === "in_progress" &&
          (match.tableNumber ?? 0) > 0 &&
          previousMatchStatusesRef.current.get(match.id) !== "in_progress",
      );

      previousMatchStatusesRef.current = new Map(
        result.matches.map((match) => [match.id, match.status]),
      );

      setMatchResponse(result);

      if (newlyStartedMatch) {
        onMatchStarted?.({
          matchId: newlyStartedMatch.id,
          tableNumber: newlyStartedMatch.tableNumber ?? 0,
          opponentName: newlyStartedMatch.opponentTeam.name,
        });
      }
    },
    [onMatchStarted],
  );

  useEffect(() => {
    let cancelled = false;

    getMyIndividualMatches(responseToken)
      .then((result) => {
        if (!cancelled) {
          applyMatchResponse(result);
          setError("");
        }
      })
      .catch((caughtError) => {
        if (!cancelled) {
          setError(
            getErrorMessage(caughtError, "내 경기 목록을 불러오지 못했습니다."),
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
  }, [applyMatchResponse, responseToken]);

  useEffect(() => {
    let cancelled = false;
    let isRequesting = false;

    const refreshMatches = async () => {
      if (cancelled || isRequesting || document.visibilityState !== "visible") {
        return;
      }

      isRequesting = true;

      try {
        const result = await getMyIndividualMatches(responseToken);

        if (!cancelled) {
          applyMatchResponse(result);
        }
      } catch {
        /*
         * 자동 갱신 실패 시 기존 화면을 유지합니다.
         */
      } finally {
        isRequesting = false;
      }
    };

    const intervalId = window.setInterval(() => {
      void refreshMatches();
    }, PUBLIC_MATCH_REFRESH_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshMatches();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;

      window.clearInterval(intervalId);

      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [applyMatchResponse, responseToken]);

  const reloadMatches = async () => {
    setIsLoading(true);
    setError("");

    try {
      const result = await getMyIndividualMatches(responseToken);

      applyMatchResponse(result);
    } catch (caughtError) {
      setError(
        getErrorMessage(caughtError, "내 경기 목록을 불러오지 못했습니다."),
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !matchResponse) {
    return (
      <section className={styles.section}>
        내 대진표를 불러오는 중입니다…
      </section>
    );
  }

  const activeMatch = matchResponse?.matches.find(
    (match) => match.status === "in_progress",
  );

  const orderedMatches = matchResponse
    ? [...matchResponse.matches].sort((left, right) => {
        const leftPriority = left.status === "in_progress" ? 0 : 1;
        const rightPriority = right.status === "in_progress" ? 0 : 1;

        return leftPriority - rightPriority || left.sortOrder - right.sortOrder;
      })
    : [];

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <div>
          <h2>내 개인 단식 경기</h2>

          <p>진행 중인 경기를 선택하여 최종 점수를 입력해 주세요.</p>
        </div>

        <button
          type="button"
          className={styles.iconButton}
          disabled={isLoading}
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

      {matchResponse?.operationStatus === "in_progress" && (
        <div
          className={
            activeMatch
              ? styles.individualOperationActive
              : styles.individualOperationWaiting
          }
          role="status"
        >
          <strong>
            {activeMatch
              ? `${activeMatch.tableNumber ?? "-"}번 테이블 경기 진행 중`
              : "단식 리그 진행 중"}
          </strong>
          <span>
            {activeMatch
              ? `${activeMatch.opponentTeam.name}님과 경기를 진행해 주세요.`
              : "내 경기 배정을 기다리고 있습니다."}
          </span>
        </div>
      )}

      {matchResponse?.operationStatus === "completed" && (
        <div className={styles.individualOperationCompleted} role="status">
          <strong>단식 리그 완료</strong>
          <span>모든 개인 단식 경기가 종료됐습니다.</span>
        </div>
      )}

      {!matchResponse?.matches || matchResponse.matches.length === 0 ? (
        <p className={styles.empty}>아직 확정된 개인 단식 대진이 없습니다.</p>
      ) : (
        <div className={styles.matchList}>
          {orderedMatches.map((match) => {
            const canOpenResult =
              match.status === "in_progress" || match.status === "completed";

            const isOpened = openedMatchId === match.id;

            return (
              <div key={match.id}>
                <button
                  type="button"
                  className={
                    isOpened ? styles.matchButtonActive : styles.matchButton
                  }
                  disabled={!canOpenResult}
                  onClick={() => {
                    setOpenedMatchId((current) =>
                      current === match.id ? "" : match.id,
                    );
                  }}
                >
                  <span>
                    {match.round}라운드 · {match.sortOrder}번째 경기
                  </span>

                  <strong>나 VS {match.opponentTeam.name}</strong>

                  <small>
                    {match.status === "in_progress" &&
                    (match.tableNumber ?? 0) > 0
                      ? `${match.tableNumber}번 테이블 · ${getStatusLabel(
                          match.status,
                        )}`
                      : `경기 상태: ${getStatusLabel(match.status)}`}
                  </small>
                </button>

                {isOpened && canOpenResult && (
                  <PublicMatchResultForm
                    targetType="individual_match"
                    targetId={match.id}
                    responseToken={responseToken}
                    onResultUpdated={reloadMatches}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
