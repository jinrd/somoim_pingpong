import type { StandingsMatch, StandingsRow } from "./types";

export const formatSetRatio = (row: StandingsRow): string => {
  if (row.setRatio !== null) {
    return row.setRatio.toFixed(3);
  }

  return row.scoreFor > 0 ? "∞" : "-";
};

export const getMatrixCellLabel = (
  match: StandingsMatch,
  rowId: string,
): string => {
  if (match.resultStatus === "disputed") {
    return "불일치";
  }

  if (match.resultStatus !== "confirmed") {
    return match.status === "in_progress" ? "진행" : "대기";
  }

  return match.homeEntity.id === rowId
    ? `${match.homeScore}:${match.awayScore}`
    : `${match.awayScore}:${match.homeScore}`;
};

export const orientMatchForEntity = (
  match: StandingsMatch,
  entityId: string,
): StandingsMatch => {
  if (match.homeEntity.id === entityId) {
    return match;
  }

  return {
    ...match,
    homeEntity: match.awayEntity,
    awayEntity: match.homeEntity,
    homeScore: match.awayScore,
    awayScore: match.homeScore,
    games: match.games.map((game) => ({
      ...game,
      homeScore: game.awayScore,
      awayScore: game.homeScore,
      winnerSide:
        game.winnerSide === "home"
          ? "away"
          : game.winnerSide === "away"
            ? "home"
            : "",
      homePlayers: game.awayPlayers,
      awayPlayers: game.homePlayers,
    })),
  };
};
