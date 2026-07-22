import { describe, expect, it } from "vitest";

import { generateRoundRobin, type RoundRobinTeam } from "./generateRoundRobin";

const createTeams = (count: number): RoundRobinTeam[] => {
  return Array.from({ length: count }, (_, index) => ({
    id: `team-${index + 1}`,
    name: `${String.fromCharCode(65 + index)}팀`,
    sortOrder: index + 1,
  }));
};

describe("generateRoundRobin", () => {
  it("4팀의 단일 풀리그 대진을 생성한다", () => {
    const result = generateRoundRobin(createTeams(4));

    expect(result.teamCount).toBe(4);
    expect(result.totalRoundCount).toBe(3);
    expect(result.totalMatchCount).toBe(6);

    expect(result.rounds).toHaveLength(3);
    expect(result.rounds.every((round) => round.matches.length === 2)).toBe(
      true,
    );
  });

  it("6팀이면 총 15경기를 생성한다", () => {
    const result = generateRoundRobin(createTeams(6));

    expect(result.totalRoundCount).toBe(5);
    expect(result.totalMatchCount).toBe(15);
  });

  it("홀수 팀이면 라운드마다 한 팀에 bye를 배정한다", () => {
    const result = generateRoundRobin(createTeams(5));

    expect(result.totalRoundCount).toBe(5);
    expect(result.totalMatchCount).toBe(10);

    expect(
      result.rounds.every(
        (round) => round.matches.length === 2 && round.byeTeam !== null,
      ),
    ).toBe(true);
  });

  it("동일한 팀 조합을 중복 생성하지 않는다", () => {
    const result = generateRoundRobin(createTeams(7));

    const pairKeys = result.matches.map((match) => match.pairKey);

    expect(new Set(pairKeys).size).toBe(pairKeys.length);
    expect(result.totalMatchCount).toBe(21);
  });

  it("모든 팀이 다른 팀과 한 번씩 대결한다", () => {
    const teams = createTeams(8);
    const result = generateRoundRobin(teams);

    for (const team of teams) {
      const teamMatches = result.matches.filter(
        (match) => match.homeTeamId === team.id || match.awayTeamId === team.id,
      );

      expect(teamMatches).toHaveLength(teams.length - 1);
    }
  });

  it("경기 순서를 1부터 연속으로 생성한다", () => {
    const result = generateRoundRobin(createTeams(5));

    expect(result.matches.map((match) => match.sortOrder)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  it("팀이 2개 미만이면 오류가 발생한다", () => {
    expect(() => generateRoundRobin(createTeams(1))).toThrow(
      "대진을 생성하려면 팀이 최소 2개 필요합니다.",
    );
  });

  it("동일한 팀 ID가 있으면 오류가 발생한다", () => {
    const duplicatedTeams = createTeams(3);

    duplicatedTeams[2] = {
      ...duplicatedTeams[2],
      id: duplicatedTeams[0].id,
    };

    expect(() => generateRoundRobin(duplicatedTeams)).toThrow(
      "동일한 팀이 중복되어 있습니다.",
    );
  });
});
