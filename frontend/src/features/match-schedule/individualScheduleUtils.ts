export const shuffleParticipants = <T extends { sortOrder: number }>(
  participants: T[],
): T[] => {
  const shuffled = [...participants];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));

    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }

  return shuffled.map((participant, index) => ({
    ...participant,
    sortOrder: index + 1,
  }));
};

export const getIndividualMatchOrderSignature = (
  matches: Array<{
    pairKey: string;
    sortOrder: number;
  }>,
): string =>
  [...matches]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((match) => match.pairKey)
    .join("|");
