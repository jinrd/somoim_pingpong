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

  const [loadedGameSetting, setLoadedGameSetting] =
    useState<EventGameSetting | null>(null);
  const [gameSettingLoadedFor, setGameSettingLoadedFor] = useState("");

  const [formationStatus, setFormationStatus] =
    useState<TeamFormationStatus | null>(null);
  const [formationStatusLoadedFor, setFormationStatusLoadedFor] = useState("");

  const [hasSchedule, setHasSchedule] = useState(false);
  const [scheduleStatusLoadedFor, setScheduleStatusLoadedFor] = useState("");

  const [configurationRevision, setConfigurationRevision] = useState(0);

  useEffect(() => {
    if (!eventId) {
      return;
    }

    let cancelled = false;

    getEventGameSetting(eventId)
      .then((setting) => {
        if (!cancelled) {
          setLoadedGameSetting(setting);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadedGameSetting(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setGameSettingLoadedFor(eventId);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const gameSetting =
    gameSettingLoadedFor === eventId ? loadedGameSetting : null;

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
      })
      .finally(() => {
        if (!cancelled) {
          setFormationStatusLoadedFor(gameSetting.id);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [gameSetting]);

  const handleGameConfigurationReset = useCallback(() => {
    setLoadedGameSetting(null);
    setGameSettingLoadedFor(eventId ?? "");
    setFormationStatus(null);
    setFormationStatusLoadedFor("");
    setHasSchedule(false);
    setScheduleStatusLoadedFor("");
    setConfigurationRevision((current) => current + 1);
    setActiveStep("participants");
  }, [eventId, setActiveStep]);

  const handleSettingConfigurationReset = useCallback(() => {
    setFormationStatus(null);
    setFormationStatusLoadedFor("");
    setHasSchedule(false);
    setScheduleStatusLoadedFor("");
    setActiveStep("game-settings");
  }, [setActiveStep]);

  const handleSettingChanged = useCallback(
    (nextSetting: EventGameSetting | null) => {
      setLoadedGameSetting(nextSetting);
      setGameSettingLoadedFor(eventId ?? "");
      setHasSchedule(false);
      setScheduleStatusLoadedFor("");
      setActiveStep("game-settings");

      if (
        !nextSetting ||
        nextSetting.status !== "confirmed" ||
        nextSetting.competition_type !== "team_league"
      ) {
        setFormationStatus(null);
        setFormationStatusLoadedFor("");
      }
    },
    [eventId, setActiveStep],
  );

  const handleScheduleReset = useCallback(() => {
    setHasSchedule(false);
    setScheduleStatusLoadedFor(gameSetting?.id ?? "");
  }, [gameSetting?.id]);

  const handleFormationChanged = useCallback(
    (status: TeamFormationStatus | null) => {
      setFormationStatus(status);
      setFormationStatusLoadedFor(gameSetting?.id ?? "");
    },
    [gameSetting?.id],
  );

  const handleScheduleChanged = useCallback(
    (nextHasSchedule: boolean) => {
      setHasSchedule(nextHasSchedule);
      setScheduleStatusLoadedFor(gameSetting?.id ?? "");
    },
    [gameSetting?.id],
  );

  const workflow = getEventWorkflow({
    gameSetting,
    formationStatus:
      formationStatusLoadedFor === gameSetting?.id ? formationStatus : null,
    hasSchedule:
      scheduleStatusLoadedFor === gameSetting?.id ? hasSchedule : false,
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
      })
      .finally(() => {
        if (!cancelled) {
          setScheduleStatusLoadedFor(gameSetting.id);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [gameSetting, workflow.canOpenSchedule]);

  const isGameSettingResolved = gameSettingLoadedFor === eventId;
  const isFormationStatusResolved =
    !workflow.canOpenFormation || formationStatusLoadedFor === gameSetting?.id;
  const isScheduleStatusResolved =
    !workflow.canOpenSchedule || scheduleStatusLoadedFor === gameSetting?.id;
  const isWorkflowResolved =
    isGameSettingResolved &&
    isFormationStatusResolved &&
    isScheduleStatusResolved;

  return {
    activeStep,
    setActiveStep,
    gameSetting,
    workflow,
    isWorkflowResolved,
    configurationRevision,
    handleGameConfigurationReset,
    handleSettingConfigurationReset,
    handleSettingChanged,
    handleScheduleReset,
    setFormationStatus: handleFormationChanged,
    setHasSchedule: handleScheduleChanged,
  };
};
