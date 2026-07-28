import { useEffect, useState } from "react";

import { RefreshCw } from "lucide-react";
import { ClientResponseError } from "pocketbase";

import PublicMatchResultForm from "../match-result/PublicMatchResultForm";

import { getMyIndividualMatches } from "./api";

import type {
  PublicParticipantMatchesResponse,
  PublicTeamMatchStatus,
} from "./types";

import styles from "./PublicLineupSection.module.css";

interface PublicIndividualLineupSectionProps {
  responseToken: string;
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
}: PublicIndividualLineupSectionProps) {
  const [matchResponse, setMatchResponse] =
    useState<PublicParticipantMatchesResponse | null>(null);

  const [openedMatchId, setOpenedMatchId] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    getMyIndividualMatches(responseToken)
      .then((result) => {
        if (!cancelled) {
          setMatchResponse(result);
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
  }, [responseToken]);

  const reloadMatches = async () => {
    setIsLoading(true);
    setError("");

    try {
      const result = await getMyIndividualMatches(responseToken);

      setMatchResponse(result);
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

      {!matchResponse?.matches || matchResponse.matches.length === 0 ? (
        <p className={styles.empty}>아직 확정된 개인 단식 대진이 없습니다.</p>
      ) : (
        <div className={styles.matchList}>
          {matchResponse.matches.map((match) => {
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

                  <small>경기 상태: {getStatusLabel(match.status)}</small>
                </button>

                {isOpened && canOpenResult && (
                  <PublicMatchResultForm
                    targetType="individual_match"
                    targetId={match.id}
                    responseToken={responseToken}
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
