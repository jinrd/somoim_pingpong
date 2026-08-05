import { useCallback, useEffect, useRef, useState } from "react";

import { RefreshCw, X } from "lucide-react";

import PublicMatchResultForm from "../match-result/PublicMatchResultForm";

import {
  getPublicMatchPriority,
  getPublicMatchStatusLabel,
} from "./publicMatchStatus";
import { getMyIndividualMatches } from "./api";

import type { PublicParticipantMatchesResponse } from "./types";

import styles from "./PublicMatchesSection.module.css";
import { PUBLIC_MATCH_REFRESH_INTERVAL_MS } from "./constants";
import { getPublicFeatureErrorMessage } from "./publicErrorUtils";
import usePublicMatchPolling from "./usePublicMatchPolling";

interface PublicIndividualMatchesSectionProps {
  responseToken: string;
  onMatchStarted?: (notice: PublicIndividualMatchStartedNotice) => void;
}

export interface PublicIndividualMatchStartedNotice {
  matchId: string;
  tableNumber: number;
  opponentName: string;
}

export default function PublicIndividualMatchesSection({
  responseToken,
  onMatchStarted,
}: PublicIndividualMatchesSectionProps) {
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
  }, [applyMatchResponse, responseToken]);

  useEffect(() => {
    if (!openedMatchId) {
      return;
    }

    window.requestAnimationFrame(() => {
      document
        .getElementById(`individual-result-${openedMatchId}`)
        ?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
    });
  }, [openedMatchId]);

  const reloadMatches = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const result = await getMyIndividualMatches(responseToken);

      applyMatchResponse(result);
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
  }, [applyMatchResponse, responseToken]);

  usePublicMatchPolling({
    refresh: reloadMatches,
    intervalMs: PUBLIC_MATCH_REFRESH_INTERVAL_MS,
  });

  if (isLoading && !matchResponse) {
    return (
      <section className={styles.section}>
        내 경기 정보를 불러오는 중입니다…
      </section>
    );
  }

  const activeMatch = matchResponse?.matches.find(
    (match) => match.status === "in_progress",
  );

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
          <h2>내 경기</h2>

          <p>경기가 시작되면 상대와 테이블을 확인하고 결과를 입력합니다.</p>
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
              ? `${activeMatch.opponentTeam.name}님과 경기할 차례입니다.`
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
        <p className={styles.empty}>아직 배정된 개인 경기가 없습니다.</p>
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
                  aria-expanded={isOpened}
                  aria-controls={`individual-result-${match.id}`}
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
                      ? `${match.tableNumber}번 테이블 · ${getPublicMatchStatusLabel(
                          match.status,
                        )}`
                      : `경기 상태: ${getPublicMatchStatusLabel(match.status)}`}
                  </small>
                </button>

                {isOpened && canOpenResult && (
                  <div
                    id={`individual-result-${match.id}`}
                    className={styles.inlineEditor}
                  >
                    <div className={styles.inlineEditorHeader}>
                      <strong>경기 결과 입력</strong>

                      <button
                        type="button"
                        className={styles.closeEditorButton}
                        aria-label="경기 결과 입력 닫기"
                        onClick={() => {
                          setOpenedMatchId("");
                        }}
                      >
                        <X size={18} aria-hidden="true" />
                      </button>
                    </div>

                    <PublicMatchResultForm
                      targetType="individual_match"
                      targetId={match.id}
                      responseToken={responseToken}
                      pollingEnabled={match.status === "in_progress"}
                      onResultUpdated={reloadMatches}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
