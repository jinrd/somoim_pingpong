import { describe, expect, it } from "vitest";

import { getMatrixCellLabel, orientMatchForEntity } from "./standingsUtils";
import type { StandingsMatch } from "./types";

const match: StandingsMatch = {
  id: "match-1",
  round: 1,
  sortOrder: 1,
  status: "completed",
  resultStatus: "confirmed",
  homeEntity: { id: "team-a", name: "A팀", sortOrder: 1 },
  awayEntity: { id: "team-b", name: "B팀", sortOrder: 2 },
  homeScore: 2,
  awayScore: 1,
  winnerEntityId: "team-a",
  games: [
    {
      id: "game-1",
      sequence: 1,
      matchType: "singles",
      bestOf: 5,
      status: "completed",
      resultStatus: "confirmed",
      homeScore: 3,
      awayScore: 1,
      winnerSide: "home",
      submissionCount: 2,
      homePlayers: [{ participantId: "a", name: "가", position: 1 }],
      awayPlayers: [{ participantId: "b", name: "나", position: 1 }],
    },
  ],
};

describe("standingsUtils", () => {
  it("행의 방향에 맞춰 확정 점수를 표시한다", () => {
    expect(getMatrixCellLabel(match, "team-a")).toBe("2:1");
    expect(getMatrixCellLabel(match, "team-b")).toBe("1:2");
  });

  it("미확정 경기의 상태를 점수 대신 표시한다", () => {
    expect(
      getMatrixCellLabel(
        { ...match, status: "in_progress", resultStatus: "pending" },
        "team-a",
      ),
    ).toBe("진행");
    expect(
      getMatrixCellLabel(
        { ...match, status: "waiting", resultStatus: "disputed" },
        "team-a",
      ),
    ).toBe("불일치");
  });

  it("원정 팀 기준으로 경기와 세부 경기 방향을 함께 전환한다", () => {
    const oriented = orientMatchForEntity(match, "team-b");

    expect(oriented.homeEntity.id).toBe("team-b");
    expect(oriented.awayEntity.id).toBe("team-a");
    expect([oriented.homeScore, oriented.awayScore]).toEqual([1, 2]);
    expect(oriented.games[0].winnerSide).toBe("away");
    expect(oriented.games[0].homePlayers[0].participantId).toBe("b");
    expect(oriented.games[0].awayPlayers[0].participantId).toBe("a");
    expect(match.homeEntity.id).toBe("team-a");
    expect(match.games[0].winnerSide).toBe("home");
  });

  it("이미 홈 팀 기준이면 원본 객체를 그대로 사용한다", () => {
    expect(orientMatchForEntity(match, "team-a")).toBe(match);
  });
});
