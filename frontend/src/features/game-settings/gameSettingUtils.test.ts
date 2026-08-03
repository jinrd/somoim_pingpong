import { describe, expect, it } from "vitest";

import { isValidTeamMatchFormatCount } from "./gameSettingUtils";

describe("isValidTeamMatchFormatCount", () => {
  it.each([1, 3, 5])("%i개 세부 경기를 허용한다", (count) => {
    expect(isValidTeamMatchFormatCount(count)).toBe(true);
  });

  it.each([0, 2, 4, 6])("%i개 세부 경기를 거부한다", (count) => {
    expect(isValidTeamMatchFormatCount(count)).toBe(false);
  });
});
