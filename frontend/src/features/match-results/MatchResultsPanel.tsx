import { useCallback, useEffect, useState } from "react";

import { AlertTriangle, CheckCircle2, Clock3, RefreshCw } from "lucide-react";

import { ClientResponseError } from "pocketbase";

import type { EventGameSetting } from "../game-settings/types";

import {
  getIndividualSchedule,
  getTeamSchedule,
  type IndividualScheduleContext,
  type MatchResultStatus,
  type StoredMatchGame,
  type StoredTeamMatch,
  type TeamScheduleContext,
} from "../match-schedule/api";

import styles from "./MatchResultsPanel.module.css";

interface MatchResultsPanelProps {
  setting: EventGameSetting | null;
}

type ResultsContext =
  | {
      competitionType: "team_league";
      schedule: TeamScheduleContext;
    }
  | {
      competitionType: "individual_singles";
      schedule: IndividualScheduleContext;
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

const getResultLabel = (
  status: MatchResultStatus,
  submissionCount: number,
): string => {
  if (status === "confirmed") {
    return "결과 확정";
  }

  if (status === "disputed") {
    return "입력 불일치";
  }

  if (submissionCount === 1) {
    return "상대 입력 대기";
  }

  return "결과 미입력";
};

const getPlayersLabel = (players: StoredMatchGame["homePlayers"]): string => {
  if (players.length === 0) {
    return "출전 선수 미정";
  }

  return players.map((player) => player.name).join(" · ");
};

const ResultStatus = ({
  status,
  submissionCount,
}: {
  status: MatchResultStatus;
  submissionCount: number;
}) => {
  const className =
    status === "confirmed"
      ? styles.confirmed
      : status === "disputed"
        ? styles.disputed
        : submissionCount === 1
          ? styles.waiting
          : styles.pending;

  return (
    <span className={className}>
      {status === "confirmed" ? (
        <CheckCircle2 size={14} aria-hidden="true" />
      ) : status === "disputed" ? (
        <AlertTriangle size={14} aria-hidden="true" />
      ) : (
        <Clock3 size={14} aria-hidden="true" />
      )}

      {getResultLabel(status, submissionCount)}
    </span>
  );
};

export default function MatchResultsPanel({ setting }: MatchResultsPanelProps) {
  const [context, setContext] = useState<ResultsContext | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const [error, setError] = useState("");

  const loadResults = useCallback(async () => {
    if (!setting) {
      setContext(null);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      if (setting.competition_type === "team_league") {
        const schedule = await getTeamSchedule(setting.id);

        setContext({
          competitionType: "team_league",
          schedule,
        });
      } else {
        const schedule = await getIndividualSchedule(setting.id);

        setContext({
          competitionType: "individual_singles",
          schedule,
        });
      }
    } catch (caughtError) {
      setError(
        getErrorMessage(caughtError, "전체 경기 결과를 불러오지 못했습니다."),
      );
    } finally {
      setIsLoading(false);
    }
  }, [setting]);

  useEffect(() => {
    if (!setting) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        if (setting.competition_type === "team_league") {
          const schedule = await getTeamSchedule(setting.id);

          if (!cancelled) {
            setContext({
              competitionType: "team_league",
              schedule,
            });
          }
        } else {
          const schedule = await getIndividualSchedule(setting.id);

          if (!cancelled) {
            setContext({
              competitionType: "individual_singles",
              schedule,
            });
          }
        }

        if (!cancelled) {
          setError("");
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(
            getErrorMessage(
              caughtError,
              "전체 경기 결과를 불러오지 못했습니다.",
            ),
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    const intervalId = window.setInterval(() => {
      void load();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [setting]);

  if (!setting) {
    return null;
  }

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div>
          <h2>전체 경기 결과</h2>

          <p>입력 결과는 5초마다 자동으로 갱신됩니다.</p>
        </div>

        <button
          type="button"
          className={styles.refreshButton}
          disabled={isLoading}
          onClick={() => {
            void loadResults();
          }}
        >
          <RefreshCw size={17} aria-hidden="true" />
          새로고침
        </button>
      </header>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {!context ? (
        <p className={styles.empty}>결과 정보를 불러오는 중입니다…</p>
      ) : context.competitionType === "team_league" ? (
        <TeamResults schedule={context.schedule} />
      ) : (
        <IndividualResults schedule={context.schedule} />
      )}
    </section>
  );
}

const TeamResults = ({ schedule }: { schedule: TeamScheduleContext }) => {
  const matches = schedule.rounds.flatMap((round) => round.matches);

  if (matches.length === 0) {
    return <p className={styles.empty}>저장된 팀 대진이 없습니다.</p>;
  }

  return (
    <div className={styles.tableScroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>순서</th>
            <th>팀 대결</th>
            <th>세부 경기</th>
            <th>출전 선수</th>
            <th>점수</th>
            <th>상태</th>
          </tr>
        </thead>

        <tbody>
          {matches.flatMap((match: StoredTeamMatch) =>
            match.games.map((game) => (
              <tr key={game.id}>
                <td>
                  {match.sortOrder}-{game.sequence}
                </td>

                <td>
                  <strong>{match.homeTeam.name}</strong>
                  <span className={styles.versus}>VS</span>
                  <strong>{match.awayTeam.name}</strong>
                </td>

                <td>
                  {game.sequence}.{" "}
                  {game.matchType === "singles" ? "단식" : "복식"}
                </td>

                <td>
                  <div className={styles.playerMatchup}>
                    <span>{getPlayersLabel(game.homePlayers)}</span>

                    <span>VS</span>

                    <span>{getPlayersLabel(game.awayPlayers)}</span>
                  </div>
                </td>

                <td>
                  {game.resultStatus === "confirmed" ? (
                    <strong className={styles.score}>
                      {game.homeScore} : {game.awayScore}
                    </strong>
                  ) : (
                    <span>- : -</span>
                  )}
                </td>

                <td>
                  <ResultStatus
                    status={game.resultStatus}
                    submissionCount={game.submissionCount}
                  />
                </td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
};

const IndividualResults = ({
  schedule,
}: {
  schedule: IndividualScheduleContext;
}) => {
  const matches = schedule.rounds.flatMap((round) => round.matches);

  if (matches.length === 0) {
    return <p className={styles.empty}>저장된 개인 단식 대진이 없습니다.</p>;
  }

  return (
    <div className={styles.tableScroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>순서</th>
            <th>경기</th>
            <th>방식</th>
            <th>점수</th>
            <th>상태</th>
          </tr>
        </thead>

        <tbody>
          {matches.map((match) => (
            <tr key={match.id}>
              <td>{match.sortOrder}</td>

              <td>
                <strong>{match.homeParticipant.name}</strong>

                <span className={styles.versus}>VS</span>

                <strong>{match.awayParticipant.name}</strong>
              </td>

              <td>
                {match.bestOf}판 {Math.floor(match.bestOf / 2) + 1}
                선승
              </td>

              <td>
                {match.resultStatus === "confirmed" ? (
                  <strong className={styles.score}>
                    {match.homeScore} : {match.awayScore}
                  </strong>
                ) : (
                  <span>- : -</span>
                )}
              </td>

              <td>
                <ResultStatus
                  status={match.resultStatus}
                  submissionCount={match.submissionCount}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
