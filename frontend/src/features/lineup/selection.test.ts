import { describe, expect, it } from "vitest";

import { isLineupComplete, toggleLineupParticipant } from "./selection";

describe("toggleLineupParticipant", () => {
  it("단식에서 선수를 선택한다", () => {
    expect(toggleLineupParticipant([], "member-a", 1)).toEqual(["member-a"]);
  });

  it("단식에서 다른 선수를 선택하면 교체한다", () => {
    expect(toggleLineupParticipant(["member-a"], "member-b", 1)).toEqual([
      "member-b",
    ]);
  });

  it("선택된 선수를 다시 누르면 해제한다", () => {
    expect(toggleLineupParticipant(["member-a"], "member-a", 1)).toEqual([]);
  });

  it("복식에서는 두 명까지 선택한다", () => {
    expect(toggleLineupParticipant(["member-a"], "member-b", 2)).toEqual([
      "member-a",
      "member-b",
    ]);
  });

  it("복식에서 세 번째 선수는 추가하지 않는다", () => {
    expect(
      toggleLineupParticipant(["member-a", "member-b"], "member-c", 2),
    ).toEqual(["member-a", "member-b"]);
  });
});

describe("isLineupComplete", () => {
  const games = [
    {
      id: "singles",
      sequence: 1,
      matchType: "singles" as const,
      bestOf: 3,
      requiredPlayerCount: 1,
      status: "scheduled" as const,
    },
    {
      id: "doubles",
      sequence: 2,
      matchType: "doubles" as const,
      bestOf: 3,
      requiredPlayerCount: 2,
      status: "scheduled" as const,
    },
  ];

  it("모든 경기 인원이 채워지면 true를 반환한다", () => {
    expect(
      isLineupComplete(games, {
        singles: ["member-a"],
        doubles: ["member-a", "member-b"],
      }),
    ).toBe(true);
  });

  it("선수가 부족하면 false를 반환한다", () => {
    expect(
      isLineupComplete(games, {
        singles: ["member-a"],
        doubles: ["member-b"],
      }),
    ).toBe(false);
  });
});
