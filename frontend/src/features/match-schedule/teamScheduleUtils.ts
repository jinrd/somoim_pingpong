import type { TeamScheduleContext } from "./api";

export const shuffleTeamsForSchedule = (
  teams: TeamScheduleContext["teams"],
): TeamScheduleContext["teams"] => {
  const shuffled = [...teams];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));

    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }

  return shuffled.map((team, index) => ({
    ...team,
    sortOrder: index + 1,
  }));
};

export const getMatchOrderSignature = (
  matches: Array<{ pairKey: string; sortOrder: number }>,
): string =>
  [...matches]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((match) => match.pairKey)
    .join("|");
