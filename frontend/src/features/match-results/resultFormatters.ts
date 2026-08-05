import type { StoredMatchGame } from "../match-schedule/api";

export { getBestOfLabel } from "../match-schedule/matchFormatUtils";

export const getPlayersLabel = (
  players: StoredMatchGame["homePlayers"],
): string => {
  if (players.length === 0) {
    return "출전 선수 미정";
  }

  return players.map((player) => player.name).join(" · ");
};

export const getMatchTypeLabel = (
  matchType: StoredMatchGame["matchType"],
): string => {
  return matchType === "singles" ? "단식" : "복식";
};

export const getScoreLabel = (
  resultStatus: StoredMatchGame["resultStatus"],
  homeScore: number,
  awayScore: number,
): string => {
  return resultStatus === "confirmed" ? `${homeScore} : ${awayScore}` : "- : -";
};


