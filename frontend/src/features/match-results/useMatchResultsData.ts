import { useCallback, useEffect, useRef, useState } from "react";

import { ClientResponseError } from "pocketbase";

import type { EventGameSetting } from "../game-settings/types";
import {
  getIndividualSchedule,
  getTeamSchedule,
} from "../match-schedule/api";

import type { ResultsContext } from "./types";

const REFRESH_INTERVAL_MS = 15_000;

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof ClientResponseError) {
    return error.response?.message || error.message || fallback;
  }

  return error instanceof Error ? error.message : fallback;
};

export default function useMatchResultsData(setting: EventGameSetting | null) {
  const [data, setData] = useState<{
    settingId: string;
    context: ResultsContext;
  } | null>(null);
  const [error, setError] = useState("");
  const activeRequestRef = useRef<{ settingId: string; id: number } | null>(
    null,
  );
  const latestRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  const loadResults = useCallback(
    async () => {
      if (!setting || activeRequestRef.current?.settingId === setting.id) {
        return;
      }

      const requestId = latestRequestIdRef.current + 1;
      latestRequestIdRef.current = requestId;
      activeRequestRef.current = { settingId: setting.id, id: requestId };

      try {
        let nextContext: ResultsContext;

        if (setting.competition_type === "team_league") {
          const schedule = await getTeamSchedule(setting.id);
          nextContext = { competitionType: "team_league", schedule };
        } else {
          const schedule = await getIndividualSchedule(setting.id);
          nextContext = { competitionType: "individual_singles", schedule };
        }

        if (isMountedRef.current && latestRequestIdRef.current === requestId) {
          setData({ settingId: setting.id, context: nextContext });
          setError("");
        }
      } catch (caughtError) {
        if (isMountedRef.current && latestRequestIdRef.current === requestId) {
          setError(
            getErrorMessage(
              caughtError,
              "전체 경기 결과를 불러오지 못했습니다.",
            ),
          );
        }
      } finally {
        if (activeRequestRef.current?.id === requestId) {
          activeRequestRef.current = null;
        }
      }
    },
    [setting],
  );

  useEffect(() => {
    isMountedRef.current = true;

    const initialLoadId = window.setTimeout(() => {
      void loadResults();
    }, 0);

    const refreshVisibleResults = () => {
      if (!document.hidden) {
        void loadResults();
      }
    };

    const intervalId = window.setInterval(
      refreshVisibleResults,
      REFRESH_INTERVAL_MS,
    );

    document.addEventListener("visibilitychange", refreshVisibleResults);

    return () => {
      isMountedRef.current = false;
      latestRequestIdRef.current += 1;
      window.clearTimeout(initialLoadId);
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshVisibleResults);
    };
  }, [loadResults]);

  const context =
    data && data.settingId === setting?.id ? data.context : null;

  return { context, error };
}
