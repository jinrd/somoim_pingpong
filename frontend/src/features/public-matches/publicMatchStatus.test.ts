import { describe, expect, it } from "vitest";

import {
  getPublicMatchPriority,
  getPublicMatchStatusLabel,
} from "./publicMatchStatus";

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
});
