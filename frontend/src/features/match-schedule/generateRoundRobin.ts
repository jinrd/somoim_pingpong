export interface RoundRobinTeam {
  id: string;
  name: string;
  sortOrder: number;
}

export interface ScheduledTeamMatch {
  key: string;
  pairKey: string;

  round: number;
  sortOrder: number;

  homeTeamId: string;
  homeTeamName: string;

  awayTeamId: string;
  awayTeamName: string;
}

export interface ScheduledRound {
  round: number;
  matches: ScheduledTeamMatch[];

  /**
   * 홀수 팀 풀리그에서 해당 라운드에 쉬는 팀입니다.
   */
  byeTeam: RoundRobinTeam | null;
}

export interface RoundRobinSchedule {
  teamCount: number;
  totalRoundCount: number;
  totalMatchCount: number;

  rounds: ScheduledRound[];
  matches: ScheduledTeamMatch[];
}

const createPairKey = (firstTeamId: string, secondTeamId: string): string => {
  return [firstTeamId, secondTeamId].sort().join(":");
};

const validateTeams = (teams: RoundRobinTeam[]): void => {
  if (teams.length < 2) {
    throw new Error("대진을 생성하려면 팀이 최소 2개 필요합니다.");
  }

  const teamIds = teams.map((team) => team.id);
  const uniqueTeamIds = new Set(teamIds);

  if (teamIds.some((teamId) => !teamId.trim())) {
    throw new Error("팀 ID가 없는 팀은 대진에 포함할 수 없습니다.");
  }

  if (uniqueTeamIds.size !== teamIds.length) {
    throw new Error("동일한 팀이 중복되어 있습니다.");
  }
};

/**
 * Circle method를 사용해 모든 팀이 서로 한 번씩 대결하는
 * 단일 풀리그 대진을 생성합니다.
 */
export const generateRoundRobin = (
  inputTeams: RoundRobinTeam[],
): RoundRobinSchedule => {
  validateTeams(inputTeams);

  const teams = [...inputTeams].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
  );

  /*
   * 팀 수가 홀수이면 null을 가상의 bye 팀으로 추가합니다.
   */
  let rotation: Array<RoundRobinTeam | null> = [...teams];

  if (rotation.length % 2 !== 0) {
    rotation.push(null);
  }

  const totalRoundCount = rotation.length - 1;
  const pairCountPerRound = rotation.length / 2;

  const rounds: ScheduledRound[] = [];
  const matches: ScheduledTeamMatch[] = [];

  let globalSortOrder = 1;

  for (let roundIndex = 0; roundIndex < totalRoundCount; roundIndex += 1) {
    const roundNumber = roundIndex + 1;
    const roundMatches: ScheduledTeamMatch[] = [];

    let byeTeam: RoundRobinTeam | null = null;

    for (let pairIndex = 0; pairIndex < pairCountPerRound; pairIndex += 1) {
      const leftTeam = rotation[pairIndex] ?? null;
      const rightTeam = rotation[rotation.length - 1 - pairIndex] ?? null;

      if (!leftTeam || !rightTeam) {
        byeTeam = leftTeam ?? rightTeam;
        continue;
      }

      /*
       * 홈/원정이 한쪽에 계속 몰리지 않도록
       * 라운드와 페어 순서에 따라 방향을 교체합니다.
       */
      const shouldSwap = (roundIndex + pairIndex) % 2 !== 0;

      const homeTeam = shouldSwap ? rightTeam : leftTeam;
      const awayTeam = shouldSwap ? leftTeam : rightTeam;

      const pairKey = createPairKey(homeTeam.id, awayTeam.id);

      const match: ScheduledTeamMatch = {
        key: pairKey,
        pairKey,

        round: roundNumber,
        sortOrder: globalSortOrder,

        homeTeamId: homeTeam.id,
        homeTeamName: homeTeam.name,

        awayTeamId: awayTeam.id,
        awayTeamName: awayTeam.name,
      };

      roundMatches.push(match);
      matches.push(match);

      globalSortOrder += 1;
    }

    rounds.push({
      round: roundNumber,
      matches: roundMatches,
      byeTeam,
    });

    /*
     * 첫 번째 팀은 고정하고 나머지 팀을 한 칸씩 회전합니다.
     */
    const fixedTeam = rotation[0];
    const rotatingTeams = rotation.slice(1);
    const lastTeam = rotatingTeams.pop();

    if (fixedTeam === undefined || lastTeam === undefined) {
      throw new Error("대진 회전 중 팀 정보를 찾지 못했습니다.");
    }

    rotation = [fixedTeam, lastTeam, ...rotatingTeams];
  }

  return {
    teamCount: teams.length,
    totalRoundCount,
    totalMatchCount: matches.length,

    rounds,
    matches,
  };
};
