import { useCallback, useEffect, useState } from "react";

import type { EventGameSetting } from "../game-settings/types";

import { getIndividualSchedule, type IndividualScheduleContext } from "./api";
import type { RoundRobinSchedule } from "./generateRoundRobin";
import { getScheduleErrorMessage } from "./scheduleErrorUtils";

interface Options {
  setting: EventGameSetting | null;
  onScheduleChanged?: (hasSchedule: boolean) => void;
}

export default function useIndividualScheduleData({
  setting,
  onScheduleChanged,
}: Options) {
  const [context, setContext] = useState<IndividualScheduleContext | null>(
    null,
  );
  const [preview, setPreview] = useState<RoundRobinSchedule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const applyLoadedSchedule = useCallback(
    (loadedContext: IndividualScheduleContext) => {
      setContext(loadedContext);
      setPreview(null);
      setError("");

      onScheduleChanged?.(loadedContext.totalMatchCount > 0);

      if (loadedContext.participants.length < 2) {
        setError("게임 참가 인원이 최소 2명 필요합니다.");
        setMessage("");
        return;
      }

      if (loadedContext.totalMatchCount === 0) {
        setMessage("등록된 대진표가 없습니다. 대진표 생성 버튼을 눌러 주세요.");
      } else {
        setMessage("");
      }
    },
    [onScheduleChanged],
  );

  const loadSchedule = useCallback(async () => {
    if (!setting || setting.competition_type !== "individual_singles") {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const loadedContext = await getIndividualSchedule(setting.id);
      applyLoadedSchedule(loadedContext);
    } catch (caughtError) {
      setError(
        getScheduleErrorMessage(
          caughtError,
          "대진 정보를 불러오지 못했습니다.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }, [applyLoadedSchedule, setting]);

  useEffect(() => {
    if (!setting || setting.competition_type !== "individual_singles") {
      return;
    }

    let cancelled = false;

    getIndividualSchedule(setting.id)
      .then((loadedContext) => {
        if (!cancelled) {
          applyLoadedSchedule(loadedContext);
        }
      })
      .catch((caughtError) => {
        if (!cancelled) {
          setError(
            getScheduleErrorMessage(
              caughtError,
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
    error,
    message,
    setContext,
    setPreview,
    setError,
    setMessage,
    applyLoadedSchedule,
    loadSchedule,
  };
}
