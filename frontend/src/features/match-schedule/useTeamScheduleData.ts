import { useCallback, useEffect, useState } from "react";

import type { EventGameSetting } from "../game-settings/types";

import { getTeamSchedule, type TeamScheduleContext } from "./api";
import {
  generateRoundRobin,
  type RoundRobinSchedule,
} from "./generateRoundRobin";
import { getScheduleErrorMessage } from "./scheduleErrorUtils";

interface Options {
  setting: EventGameSetting | null;
  onScheduleChanged?: (hasSchedule: boolean) => void;
}

export default function useTeamScheduleData({
  setting,
  onScheduleChanged,
}: Options) {
  const [context, setContext] = useState<TeamScheduleContext | null>(null);
  const [preview, setPreview] = useState<RoundRobinSchedule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const applyLoadedSchedule = useCallback(
    (loaded: TeamScheduleContext) => {
      setContext(loaded);
      onScheduleChanged?.(loaded.totalMatchCount > 0);

      if (
        loaded.totalMatchCount === 0 &&
        loaded.formation?.status === "confirmed" &&
        loaded.teams.length >= 2
      ) {
        setPreview(generateRoundRobin(loaded.teams));
      } else {
        setPreview(null);
      }
    },
    [onScheduleChanged],
  );

  const loadSchedule = useCallback(async () => {
    if (!setting || setting.competition_type !== "team_league") {
      setContext(null);
      setPreview(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError("");

    try {
      const loaded = await getTeamSchedule(setting.id);
      applyLoadedSchedule(loaded);
    } catch (error) {
      setLoadError(
        getScheduleErrorMessage(error, "대진 정보를 불러오지 못했습니다."),
      );
    } finally {
      setIsLoading(false);
    }
  }, [applyLoadedSchedule, setting]);

  useEffect(() => {
    if (!setting || setting.competition_type !== "team_league") {
      return;
    }

    let cancelled = false;

    getTeamSchedule(setting.id)
      .then((loaded) => {
        if (cancelled) {
          return;
        }

        applyLoadedSchedule(loaded);
        setLoadError("");
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(
            getScheduleErrorMessage(
              error,
              "대진 정보를 불러오지 못했습니다.",
            ),
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applyLoadedSchedule, setting]);

  return {
    context,
    preview,
    isLoading,
    loadError,
    setContext,
    setPreview,
    loadSchedule,
  };
}
