import { useCallback, useEffect, useMemo, useState } from "react";

import { CirclePlay, Loader2, RefreshCw } from "lucide-react";

import { ClientResponseError } from "pocketbase";

import type { EventGameSetting } from "../game-settings/types";

import {
  changeIndividualMatchStatus,
  changeTeamMatchStatus,
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
  canStart: boolean;
}

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

                canStart:
                  match.status === "ready" &&
                  match.homeLineupStatus === "confirmed" &&
                  match.awayLineupStatus === "confirmed",
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

                description: `${match.bestOf}판 경기`,

                canStart: match.status === "scheduled",
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

  const handleStartMatch = async (match: MonitorMatch) => {
    if (!setting || !match.canStart) {
      return;
    }

    const shouldStart = window.confirm(
      `${match.title} 경기를 시작할까요?\n경기 시작 후에는 참석자와 라인업을 변경할 수 없습니다.`,
    );

    if (!shouldStart) {
      return;
    }

    setWorkingMatchId(match.id);
    setError("");
    setMessage("");

    try {
      if (setting.competition_type === "team_league") {
        await changeTeamMatchStatus(match.id, {
          expectedVersion: match.version,
          nextStatus: "in_progress",
        });
      } else {
        await changeIndividualMatchStatus(match.id, {
          expectedVersion: match.version,
          nextStatus: "in_progress",
        });
      }

      setMessage(`${match.title} 경기를 시작했습니다.`);

      await loadMatches(false);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "경기를 시작하지 못했습니다."));

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
        <div>
          <span>전체</span>
          <strong>{summary.total}</strong>
        </div>

        <div>
          <span>대기</span>
          <strong>{summary.ready}</strong>
        </div>

        <div>
          <span>진행 중</span>
          <strong>{summary.inProgress}</strong>
        </div>

        <div>
          <span>완료</span>
          <strong>{summary.completed}</strong>
        </div>
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
          {matches.map((match) => (
            <article key={match.id} className={styles.matchCard}>
              <div className={styles.order}>
                <span>경기 순서</span>
                <strong>{match.sortOrder}</strong>
              </div>

              <div className={styles.matchContent}>
                <small>라운드 {match.round}</small>

                <strong>{match.title}</strong>

                <span>{match.description}</span>
              </div>

              <span
                className={`${styles.status} ${
                  styles[`status_${match.status}`]
                }`}
              >
                {STATUS_LABELS[match.status]}
              </span>

              <button
                type="button"
                className={styles.startButton}
                disabled={!match.canStart || Boolean(workingMatchId)}
                onClick={() => {
                  void handleStartMatch(match);
                }}
              >
                {workingMatchId === match.id ? (
                  <Loader2
                    className={styles.spinner}
                    size={17}
                    aria-hidden="true"
                  />
                ) : (
                  <CirclePlay size={17} aria-hidden="true" />
                )}

                {match.status === "in_progress"
                  ? "진행 중"
                  : match.status === "completed"
                    ? "완료"
                    : match.canStart
                      ? "경기 시작"
                      : "시작 대기"}
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
