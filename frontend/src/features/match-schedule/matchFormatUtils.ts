export const getRequiredWins = (bestOf: number): number =>
  Math.floor(bestOf / 2) + 1;

export const getBestOfLabel = (bestOf: number): string => {
  if (bestOf === 1) {
    return "단판";
  }

  return `${bestOf}판 ${getRequiredWins(bestOf)}선승`;
};
