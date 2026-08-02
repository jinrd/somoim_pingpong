import { useCallback, useEffect, useState } from "react";

import { ClientResponseError } from "pocketbase";

import type { EventGameSetting } from "../game-settings/types";

import { getIndividualSchedule, getTeamSchedule } from "../match-schedule/api";

import { MATCH_MONITOR_REFRESH_INTERVAL_MS } from "./constants";
import type { MonitorMatch } from "./types";

interface Options {
  setting: EventGameSetting | null;
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

export default function useMatchMonitorData({ setting }: Options) {
  const [matches, setMatches] = useState<MonitorMatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

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
                description: "결과 입력 시 실제 출전 선수를 기록합니다.",
                results: match.games.map((game) => {
                  const typeLabel =
                    game.matchType === "singles" ? "단식" : "복식";

                  const homePlayers =
                    game.homePlayers.map((player) => player.name).join("·") ||
                    match.homeTeam.name;

                  const awayPlayers =
                    game.awayPlayers.map((player) => player.name).join("·") ||
                    match.awayTeam.name;

                  return {
                    id: game.id,
                    type: "team_game" as const,
                    title: `${game.sequence}. ${typeLabel}`,
                    homeName: homePlayers,
                    awayName: awayPlayers,
                    bestOf: game.bestOf,
                    version: game.version,
                    status: game.status,
                    resultStatus: game.resultStatus,
                    homeScore: game.homeScore,
                    awayScore: game.awayScore,
                    submissionCount: game.submissionCount,
                    requiredPlayerCount:
                      game.matchType === "doubles" ? 2 : 1,
                    homePlayerOptions: match.homeMembers,
                    awayPlayerOptions: match.awayMembers,
                    homePlayerIds: game.homePlayers.map(
                      (player) => player.participantId,
                    ),
                    awayPlayerIds: game.awayPlayers.map(
                      (player) => player.participantId,
                    ),
                  };
                }),
                canCancelResult: match.games.some(
                  (game) => game.resultStatus === "confirmed",
                ),
                hasDisputedResult: match.games.some(
                  (game) => game.resultStatus === "disputed",
                ),
              })),
            ),
          );
        } else {
          const schedule = await getIndividualSchedule(setting.id);

          setMatches(
            schedule.rounds.flatMap((round) =>
              round.matches.map((match) => ({
                id: match.id,
                round: match.round,
                sortOrder: match.sortOrder,
                status: match.status,
                version: match.version,
                title:
                  `${match.homeParticipant.name} vs ` +
                  match.awayParticipant.name,
                description:
                  match.status === "in_progress" && match.tableNumber > 0
                    ? `${match.tableNumber}번 테이블 · ${match.bestOf}판 경기`
                    : `${match.bestOf}판 경기`,
                canCancelResult: match.resultStatus === "confirmed",
                results: [
                  {
                    id: match.id,
                    type: "individual_match" as const,
                    title: "개인 단식",
                    homeName: match.homeParticipant.name,
                    awayName: match.awayParticipant.name,
                    bestOf: match.bestOf,
                    version: match.version,
                    status: match.status,
                    resultStatus: match.resultStatus,
                    homeScore: match.homeScore,
                    awayScore: match.awayScore,
                    submissionCount: match.submissionCount,
                    requiredPlayerCount: 1,
                    homePlayerOptions: [],
                    awayPlayerOptions: [],
                    homePlayerIds: [],
                    awayPlayerIds: [],
                  },
                ],
                hasDisputedResult: match.resultStatus === "disputed",
              })),
            ),
          );
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

  return {
    matches,
    isLoading,
    error,
    setError,
    loadMatches,
  };
}
