import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { getEventGameSetting } from "../game-settings/api";
import type { EventGameSetting } from "../game-settings/types";
import { getIndividualSchedule, getTeamSchedule } from "../match-schedule/api";
import type { TeamFormationStatus } from "../team-formation/types";
import { getTeamFormationContext } from "../team-formation/api";

import {
  getEventWorkflow,
  isEventManagementStep,
  type EventManagementStep,
} from "./EventWorkflow";

export const useEventManagementState = (eventId?: string) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const stepParam = searchParams.get("step");
  const activeStep: EventManagementStep = isEventManagementStep(stepParam)
    ? stepParam
    : "participants";

  const setActiveStep = useCallback(
    (step: EventManagementStep) => {
      const nextParams = new URLSearchParams(searchParams);

      if (step === "participants") {
        nextParams.delete("step");
      } else {
        nextParams.set("step", step);
      }

      setSearchParams(nextParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const [gameSetting, setGameSetting] = useState<EventGameSetting | null>(null);

  const [formationStatus, setFormationStatus] =
    useState<TeamFormationStatus | null>(null);

  const [hasSchedule, setHasSchedule] = useState(false);

  const [configurationRevision, setConfigurationRevision] = useState(0);

  useEffect(() => {
    if (!eventId) {
      return;
    }

    let cancelled = false;

    getEventGameSetting(eventId)
      .then((setting) => {
        if (!cancelled) {
          setGameSetting(setting);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGameSetting(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  useEffect(() => {
    if (
      !gameSetting ||
      gameSetting.status !== "confirmed" ||
      gameSetting.competition_type !== "team_league"
    ) {
      return;
    }

    let cancelled = false;

    getTeamFormationContext(gameSetting.id)
      .then((context) => {
        if (!cancelled) {
          setFormationStatus(context.formation?.status ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFormationStatus(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [gameSetting]);

  const handleGameConfigurationReset = useCallback(() => {
    setGameSetting(null);
    setFormationStatus(null);
    setHasSchedule(false);
    setConfigurationRevision((current) => current + 1);
    setActiveStep("participants");
  }, [setActiveStep]);

  const handleSettingConfigurationReset = useCallback(() => {
    setFormationStatus(null);
    setHasSchedule(false);
    setActiveStep("game-settings");
  }, [setActiveStep]);

  const handleSettingChanged = useCallback(
    (nextSetting: EventGameSetting | null) => {
      setGameSetting(nextSetting);
      setHasSchedule(false);
      setActiveStep("game-settings");

      if (
        !nextSetting ||
        nextSetting.status !== "confirmed" ||
        nextSetting.competition_type !== "team_league"
      ) {
        setFormationStatus(null);
      }
    },
    [setActiveStep],
  );

  const handleScheduleReset = useCallback(() => {
    setHasSchedule(false);
  }, []);

  const workflow = getEventWorkflow({
    gameSetting,
    formationStatus,
    hasSchedule,
  });

  useEffect(() => {
    if (!gameSetting || !workflow.canOpenSchedule) {
      return;
    }

    let cancelled = false;

    const request =
      gameSetting.competition_type === "team_league"
        ? getTeamSchedule(gameSetting.id)
        : getIndividualSchedule(gameSetting.id);

    request
      .then((schedule) => {
        if (!cancelled) {
          setHasSchedule(schedule.totalMatchCount > 0);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasSchedule(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [gameSetting, workflow.canOpenSchedule]);

  return {
    activeStep,
    setActiveStep,
    gameSetting,
    workflow,
    configurationRevision,
    handleGameConfigurationReset,
    handleSettingConfigurationReset,
    handleSettingChanged,
    handleScheduleReset,
    setFormationStatus,
    setHasSchedule,
  };
};
