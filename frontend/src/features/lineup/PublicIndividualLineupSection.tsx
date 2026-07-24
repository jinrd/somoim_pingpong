import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { getMyIndividualMatches } from "./api";
import type { PublicParticipantMatchesResponse } from "./types";
import styles from "./PublicLineupSection.module.css";
import { ClientResponseError } from "pocketbase";

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

export default function PublicIndividualLineupSection({
  responseToken,
}: PublicIndividualLineupSectionProps) {
  const [matchResponse, setMatchResponse] =
    useState<PublicParticipantMatchesResponse | null>(null);

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

  if (isLoading) {
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
          <h2>내 대진표</h2>
          <p>이번 회차에 배정된 내 개인 단식 풀리그 경기 목록입니다.</p>
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
        <p className={styles.empty}>아직 확정된 대진이 없습니다.</p>
      ) : (
        <div className={styles.matchList}>
          {matchResponse.matches.map((match) => (
            <div
              key={match.id}
              className={styles.matchButton}
              style={{ cursor: "default" }}
            >
              <span>
                {match.round}라운드 · {match.sortOrder}번째 경기
              </span>

              <strong>나 VS {match.opponentTeam.name}</strong>

              <small>
                진행 상태: {match.status === "completed" && "경기 완료"}
                {match.status === "in_progress" && "진행 중"}
                {match.status === "scheduled" && "대기 중"}
              </small>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
