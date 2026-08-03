import type { EventGameSetting } from "../game-settings/types";
import type { TeamFormationStatus } from "../team-formation/types";

export type EventManagementStep =
  | "participants"
  | "game-settings"
  | "formation"
  | "schedule"
  | "monitor"
  | "results"
  | "standings";

const EVENT_MANAGEMENT_STEPS: EventManagementStep[] = [
  "participants",
  "game-settings",
  "formation",
  "schedule",
  "monitor",
  "results",
  "standings",
];

export const isEventManagementStep = (
  value: string | null,
): value is EventManagementStep => {
  return EVENT_MANAGEMENT_STEPS.some((step) => step === value);
};

interface EventWorkflowInput {
  gameSetting: EventGameSetting | null;
  formationStatus: TeamFormationStatus | null;
  hasSchedule: boolean;
}

export interface EventWorkflow {
  hasConfirmedSetting: boolean;
  isTeamCompetition: boolean;
  isIndividualCompetition: boolean;
  showFormation: boolean;
  canOpenFormation: boolean;
  canOpenSchedule: boolean;
  canOpenMatchViews: boolean;
}

export const getEventWorkflow = ({
  gameSetting,
  formationStatus,
  hasSchedule,
}: EventWorkflowInput): EventWorkflow => {
  const hasConfirmedSetting = gameSetting?.status === "confirmed";
  const isTeamCompetition = gameSetting?.competition_type === "team_league";
  const isIndividualCompetition =
    gameSetting?.competition_type === "individual_singles";

  const canOpenFormation = hasConfirmedSetting && isTeamCompetition;

  const canOpenSchedule =
    hasConfirmedSetting &&
    (isIndividualCompetition ||
      (isTeamCompetition && formationStatus === "confirmed"));

  return {
    hasConfirmedSetting,
    isTeamCompetition,
    isIndividualCompetition,
    showFormation: isTeamCompetition,
    canOpenFormation,
    canOpenSchedule,
    canOpenMatchViews: canOpenSchedule && hasSchedule,
  };
};

export const getAvailableManagementStep = (
  requestedStep: EventManagementStep,
  workflow: EventWorkflow,
): EventManagementStep => {
  if (requestedStep === "participants" || requestedStep === "game-settings") {
    return requestedStep;
  }

  if (requestedStep === "formation") {
    return workflow.canOpenFormation ? requestedStep : "game-settings";
  }

  if (requestedStep === "schedule") {
    return workflow.canOpenSchedule
      ? requestedStep
      : workflow.canOpenFormation
        ? "formation"
        : "game-settings";
  }

  if (workflow.canOpenMatchViews) {
    return requestedStep;
  }

  if (workflow.canOpenSchedule) {
    return "schedule";
  }

  return workflow.canOpenFormation ? "formation" : "game-settings";
};
