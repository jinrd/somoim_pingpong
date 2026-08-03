import { useEffect, useState } from "react";

import { ClientResponseError } from "pocketbase";

import { getAdminStandings, getPublicStandings } from "./api";
import type { StandingsResponse } from "./types";

const REFRESH_INTERVAL_MS = 15_000;

const getErrorMessage = (error: unknown): string => {
  if (error instanceof ClientResponseError) {
    return (
      error.response?.message ||
      error.message ||
      "순위 정보를 불러오지 못했습니다."
    );
  }

  return error instanceof Error
    ? error.message
    : "순위 정보를 불러오지 못했습니다.";
};

interface Options {
  settingId?: string;
  responseToken?: string;
}

export default function useStandingsData({
  settingId,
  responseToken,
}: Options) {
  const sourceKey = settingId
    ? `admin:${settingId}`
    : responseToken
      ? `public:${responseToken}`
      : "";

  const [loadedData, setLoadedData] = useState<{
    sourceKey: string;
    response: StandingsResponse;
  } | null>(null);
  const [errorData, setErrorData] = useState<{
    sourceKey: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!sourceKey) {
      return;
    }

    let cancelled = false;
    let requesting = false;
    let refreshTimeoutId: number | undefined;

    const load = async () => {
      if (requesting) {
        return;
      }

      requesting = true;

      try {
        const result = settingId
          ? await getAdminStandings(settingId)
          : await getPublicStandings(responseToken || "");

        if (!cancelled) {
          setLoadedData({ sourceKey, response: result });
          setErrorData(null);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setErrorData({
            sourceKey,
            message: getErrorMessage(caughtError),
          });
        }
      } finally {
        requesting = false;
      }
    };

    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimeoutId);

      if (cancelled || document.hidden) {
        return;
      }

      refreshTimeoutId = window.setTimeout(async () => {
        await load();
        scheduleRefresh();
      }, REFRESH_INTERVAL_MS);
    };

    const refreshNow = async () => {
      window.clearTimeout(refreshTimeoutId);
      await load();
      scheduleRefresh();
    };

    const initialLoadId = window.setTimeout(() => {
      void refreshNow();
    }, 0);

    const handleVisibilityChange = () => {
      window.clearTimeout(refreshTimeoutId);

      if (!document.hidden) {
        void refreshNow();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearTimeout(initialLoadId);
      window.clearTimeout(refreshTimeoutId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [responseToken, settingId, sourceKey]);

  const response =
    loadedData?.sourceKey === sourceKey ? loadedData.response : null;
  const error = errorData?.sourceKey === sourceKey ? errorData.message : "";

  return { response, error };
}
