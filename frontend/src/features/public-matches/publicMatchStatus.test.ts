import { describe, expect, it } from "vitest";

import {
  canOpenPublicMatchResult,
  getPublicMatchPriority,
  getPublicMatchStatusLabel,
  groupPublicMatches,
  hasOpenPublicMatches,
} from "./publicMatchStatus";
import type { PublicParticipantMatch } from "./types";

describe("publicMatchStatus", () => {
  it("경기 상태 문구를 반환한다", () => {
    expect(getPublicMatchStatusLabel("scheduled")).toBe("경기 준비");
    expect(getPublicMatchStatusLabel("ready")).toBe("경기 시작 대기");
    expect(getPublicMatchStatusLabel("in_progress")).toBe("경기 진행 중");
    expect(getPublicMatchStatusLabel("completed")).toBe("경기 완료");
    expect(getPublicMatchStatusLabel("cancelled")).toBe("경기 취소");
  });

  it("진행 중인 경기를 가장 먼저 배치한다", () => {
    expect(getPublicMatchPriority("in_progress")).toBe(0);
    expect(getPublicMatchPriority("ready")).toBe(1);
    expect(getPublicMatchPriority("scheduled")).toBe(2);
    expect(getPublicMatchPriority("completed")).toBe(3);
    expect(getPublicMatchPriority("cancelled")).toBe(3);
  });

  it("완료와 취소 경기는 같은 우선순위를 사용한다", () => {
    expect(getPublicMatchPriority("completed")).toBe(
      getPublicMatchPriority("cancelled"),
    );
  });

  it("경기 상태별로 목록을 분리한다", () => {
    const groups = groupPublicMatches([
      { id: "1", status: "in_progress" },
      { id: "2", status: "scheduled" },
      { id: "3", status: "completed" },
      { id: "4", status: "cancelled" },
    ] as PublicParticipantMatch[]);

    expect(groups.inProgress).toHaveLength(1);
    expect(groups.upcoming).toHaveLength(1);
    expect(groups.completed).toHaveLength(1);
    expect(groups.cancelled).toHaveLength(1);
  });

  it("종료 또는 취소된 경기만 있으면 자동 갱신 대상이 아니다", () => {
    expect(
      hasOpenPublicMatches([
        { id: "1", status: "completed" },
        { id: "2", status: "cancelled" },
      ] as PublicParticipantMatch[]),
    ).toBe(false);

    expect(
      hasOpenPublicMatches([
        { id: "1", status: "ready" },
      ] as PublicParticipantMatch[]),
    ).toBe(true);
  });

  it("진행 중이거나 종료된 경기만 결과를 열 수 있다", () => {
    expect(canOpenPublicMatchResult("scheduled")).toBe(false);
    expect(canOpenPublicMatchResult("ready")).toBe(false);
    expect(canOpenPublicMatchResult("in_progress")).toBe(true);
    expect(canOpenPublicMatchResult("completed")).toBe(true);
    expect(canOpenPublicMatchResult("cancelled")).toBe(false);
  });
});
