import type { PublicLineupContext, PublicLineupGame } from "./types";

export type LineupSelections = Record<string, string[]>;

export const createLineupSelections = (
  context: PublicLineupContext,
): LineupSelections => {
  const result: LineupSelections = {};

  context.games.forEach((game) => {
    result[game.id] = context.lineup.players
      .filter((player) => player.matchGameId === game.id)
      .sort((left, right) => left.position - right.position)
      .map((player) => player.participantId);
  });

  return result;
};

export const toggleLineupParticipant = (
  currentParticipantIds: string[],
  participantId: string,
  requiredPlayerCount: number,
): string[] => {
  if (currentParticipantIds.includes(participantId)) {
    return currentParticipantIds.filter(
      (currentId) => currentId !== participantId,
    );
  }

  if (requiredPlayerCount === 1) {
    return [participantId];
  }

  if (currentParticipantIds.length >= requiredPlayerCount) {
    return currentParticipantIds;
  }

  return [...currentParticipantIds, participantId];
};

export const isLineupComplete = (
  games: PublicLineupGame[],
  selections: LineupSelections,
): boolean => {
  return games.every(
    (game) => (selections[game.id] ?? []).length === game.requiredPlayerCount,
  );
};
