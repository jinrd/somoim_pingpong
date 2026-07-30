import { describe, expect, it } from "vitest";

import {
  calculateTeamQuality,
  createTeamName,
  generateTeamFormation,
} from "./generateTeamFormation";

import type { FormationParticipant } from "./types";

const createParticipants = (count: number): FormationParticipant[] =>
  Array.from({ length: count }, (_, index) => ({
    participantId: `participant-${index + 1}`,
    participantType: "member",
    displayName: `참가자 ${index + 1}`,
    rankSnapshot: (index % 8) + 1,
  }));

const getAllParticipantIds = (
  result: ReturnType<typeof generateTeamFormation>,
): string[] =>
  result.teams.flatMap((team) =>
    team.members.map((member) => member.participantId),
  );

const createSeededRandom = (initialSeed: number) => {
  let seed = initialSeed;

  return () => {
    seed = (seed * 9301 + 49297) % 233280;

    return seed / 233280;
  };
};

describe("createTeamName", () => {
  it("알파벳 순서로 팀 이름을 생성한다", () => {
    expect(createTeamName(0)).toBe("A팀");
    expect(createTeamName(25)).toBe("Z팀");
    expect(createTeamName(26)).toBe("AA팀");
  });
});

describe("generateTeamFormation", () => {
  it("18명을 3명씩 6팀으로 편성한다", () => {
    const participants = createParticipants(18);

    const result = generateTeamFormation({
      participants,
      targetTeamSize: 3,
      method: "balanced",
    });

    expect(result.teamCount).toBe(6);
    expect(result.teams.every((team) => team.members.length === 3)).toBe(true);

    expect(new Set(getAllParticipantIds(result)).size).toBe(18);
  });

  it("19명을 3명과 2명이 섞인 7팀으로 편성한다", () => {
    const result = generateTeamFormation({
      participants: createParticipants(19),
      targetTeamSize: 3,
      method: "balanced",
    });

    expect(result.teamCount).toBe(7);

    expect(
      result.teams
        .map((team) => team.members.length)
        .sort((left, right) => left - right),
    ).toEqual([2, 2, 3, 3, 3, 3, 3]);

    expect(result.metrics.memberCountDifference).toBeLessThanOrEqual(1);
  });

  it("22명을 빈 팀이나 중복 참가자 없이 편성한다", () => {
    const result = generateTeamFormation({
      participants: createParticipants(22),
      targetTeamSize: 3,
      method: "balanced",
    });

    expect(result.teamCount).toBe(8);

    expect(
      result.teams
        .map((team) => team.members.length)
        .sort((left, right) => left - right),
    ).toEqual([2, 2, 3, 3, 3, 3, 3, 3]);

    const participantIds = getAllParticipantIds(result);

    expect(participantIds).toHaveLength(22);
    expect(new Set(participantIds).size).toBe(22);
  });

  it("같은 부수가 집중되어도 정상적으로 편성한다", () => {
    const participants = createParticipants(12).map((participant) => ({
      ...participant,
      rankSnapshot: 5,
    }));

    const result = generateTeamFormation({
      participants,
      targetTeamSize: 3,
      method: "balanced",
    });

    expect(result.teamCount).toBe(4);
    expect(result.metrics.averageRankDifference).toBe(0);
    expect(result.metrics.qualityScore).toBe(100);
  });

  it("참가자가 한 명이어도 오류 대신 경고를 반환한다", () => {
    const result = generateTeamFormation({
      participants: createParticipants(1),
      targetTeamSize: 3,
      method: "balanced",
    });

    expect(result.teamCount).toBe(1);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("참가자가 없으면 빈 편성 결과를 반환한다", () => {
    const result = generateTeamFormation({
      participants: [],
      targetTeamSize: 3,
      method: "balanced",
    });

    expect(result.teams).toEqual([]);
    expect(result.teamCount).toBe(0);
    expect(result.warnings).toContain("게임 참가 상태인 참석자가 없습니다.");
  });

  it("중복 참가자는 거부한다", () => {
    const participant = createParticipants(1)[0];

    expect(() =>
      generateTeamFormation({
        participants: [participant, participant],
        targetTeamSize: 3,
        method: "balanced",
      }),
    ).toThrow("중복된 참가자가 포함되어 있습니다.");
  });

  it("0부 참가자를 정상적으로 편성한다", () => {
    const participants = createParticipants(6);

    participants[0] = {
      ...participants[0],
      rankSnapshot: 0,
    };

    const result = generateTeamFormation({
      participants,
      targetTeamSize: 3,
      method: "balanced",
    });

    expect(getAllParticipantIds(result)).toContain(
      participants[0].participantId,
    );
  });

  it("음수 부수 참가자는 거부한다", () => {
    const participants = createParticipants(6);

    participants[0] = {
      ...participants[0],
      rankSnapshot: -1,
    };

    expect(() =>
      generateTeamFormation({
        participants,
        targetTeamSize: 3,
        method: "balanced",
      }),
    ).toThrow("참가자의 부수 정보가 올바르지 않습니다.");
  });

  it("동일한 난수 입력은 동일한 무작위 편성을 만든다", () => {
    const participants = createParticipants(12);

    const first = generateTeamFormation({
      participants,
      targetTeamSize: 3,
      method: "random",
      random: createSeededRandom(10),
    });

    const second = generateTeamFormation({
      participants,
      targetTeamSize: 3,
      method: "random",
      random: createSeededRandom(10),
    });

    expect(
      first.teams.map((team) =>
        team.members.map((member) => member.participantId),
      ),
    ).toEqual(
      second.teams.map((team) =>
        team.members.map((member) => member.participantId),
      ),
    );
  });

  it("원본 참가자 배열을 변경하지 않는다", () => {
    const participants = createParticipants(18);
    const before = structuredClone(participants);

    generateTeamFormation({
      participants,
      targetTeamSize: 3,
      method: "balanced",
    });

    expect(participants).toEqual(before);
  });
});

describe("calculateTeamQuality", () => {
  it("수동으로 팀원을 이동한 뒤 품질을 다시 계산할 수 있다", () => {
    const result = generateTeamFormation({
      participants: createParticipants(12),
      targetTeamSize: 3,
      method: "balanced",
    });

    const metrics = calculateTeamQuality(result.teams);

    expect(metrics.memberCountDifference).toBe(0);
    expect(metrics.qualityScore).toBeGreaterThanOrEqual(0);
    expect(metrics.qualityScore).toBeLessThanOrEqual(100);
  });
});
