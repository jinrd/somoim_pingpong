import { describe, expect, it } from "vitest";

import {
  getAvailableManagementStep,
  type EventWorkflow,
} from "./EventWorkflow";

const createWorkflow = (
  overrides: Partial<EventWorkflow> = {},
): EventWorkflow => ({
  hasConfirmedSetting: false,
  isTeamCompetition: false,
  isIndividualCompetition: false,
  showFormation: false,
  canOpenFormation: false,
  canOpenSchedule: false,
  canOpenMatchViews: false,
  ...overrides,
});

describe("getAvailableManagementStep", () => {
  it("기본 관리 단계는 워크플로 상태와 관계없이 유지한다", () => {
    const workflow = createWorkflow();

    expect(getAvailableManagementStep("participants", workflow)).toBe(
      "participants",
    );
    expect(getAvailableManagementStep("game-settings", workflow)).toBe(
      "game-settings",
    );
  });

  it("게임 설정이 확정되지 않았으면 게임 설정으로 이동한다", () => {
    expect(
      getAvailableManagementStep("standings", createWorkflow()),
    ).toBe("game-settings");
  });

  it("팀 편성만 가능하면 팀 편성으로 이동한다", () => {
    const workflow = createWorkflow({
      hasConfirmedSetting: true,
      isTeamCompetition: true,
      showFormation: true,
      canOpenFormation: true,
    });

    expect(getAvailableManagementStep("results", workflow)).toBe(
      "formation",
    );
  });

  it("대진표까지 가능하면 대진표로 이동하고 경기 화면은 준비 후 유지한다", () => {
    const scheduleWorkflow = createWorkflow({
      hasConfirmedSetting: true,
      isIndividualCompetition: true,
      canOpenSchedule: true,
    });

    expect(getAvailableManagementStep("results", scheduleWorkflow)).toBe(
      "schedule",
    );

    const matchWorkflow = {
      ...scheduleWorkflow,
      canOpenMatchViews: true,
    };

    expect(getAvailableManagementStep("results", matchWorkflow)).toBe(
      "results",
    );
  });
});
