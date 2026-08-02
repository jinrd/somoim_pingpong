import {
  Activity,
  BarChart3,
  ClipboardCheck,
  ListOrdered,
  Shuffle,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { EventManagementStep, EventWorkflow } from "./EventWorkflow";

import styles from "./Events.module.css";

interface Props {
  activeStep: EventManagementStep;
  workflow: EventWorkflow;
  onStepChange: (step: EventManagementStep) => void;
}

interface StepItem {
  value: EventManagementStep;
  label: string;
  icon: LucideIcon;
  visible: boolean;
  enabled: boolean;
  disabledMessage?: string;
}

export default function EventManagementTabs({
  activeStep,
  workflow,
  onStepChange,
}: Props) {
  const steps: StepItem[] = [
    {
      value: "participants",
      label: "참석자",
      icon: Users,
      visible: true,
      enabled: true,
    },
    {
      value: "game-settings",
      label: "게임 설정",
      icon: Trophy,
      visible: true,
      enabled: true,
    },
    {
      value: "formation",
      label: "팀 편성",
      icon: Shuffle,
      visible: workflow.showFormation,
      enabled: workflow.canOpenFormation,
      disabledMessage: "게임 설정을 먼저 확정해 주세요.",
    },
    {
      value: "schedule",
      label: "대진표",
      icon: ListOrdered,
      visible: true,
      enabled: workflow.canOpenSchedule,
      disabledMessage: workflow.isTeamCompetition
        ? "게임 설정과 팀 편성을 최종 확정해 주세요."
        : "게임 설정을 최종 확정해 주세요.",
    },
    {
      value: "monitor",
      label: "경기 진행",
      icon: Activity,
      visible: true,
      enabled: workflow.canOpenMatchViews,
      disabledMessage: "대진표를 저장한 후 경기 진행을 시작할 수 있습니다.",
    },
    {
      value: "results",
      label: "경기 결과",
      icon: ClipboardCheck,
      visible: true,
      enabled: workflow.canOpenMatchViews,
      disabledMessage: "대진표를 먼저 저장해 주세요.",
    },
    {
      value: "standings",
      label: "순위표",
      icon: BarChart3,
      visible: true,
      enabled: workflow.canOpenMatchViews,
      disabledMessage: "대진표를 먼저 저장해 주세요.",
    },
  ];

  return (
    <nav className={styles.detailTabs} aria-label="회차 관리 단계">
      {steps
        .filter((step) => step.visible)
        .map((step) => {
          const Icon = step.icon;
          const isActive = activeStep === step.value;

          return (
            <button
              key={step.value}
              type="button"
              className={`${styles.detailTab} ${
                isActive ? styles.detailTabActive : ""
              }`}
              aria-current={isActive ? "step" : undefined}
              disabled={!step.enabled}
              title={step.enabled ? undefined : step.disabledMessage}
              onClick={() => {
                if (step.enabled) {
                  onStepChange(step.value);
                }
              }}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{step.label}</span>
            </button>
          );
        })}
    </nav>
  );
}
