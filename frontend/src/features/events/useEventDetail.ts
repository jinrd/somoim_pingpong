import { useCallback, useEffect, useState } from "react";

import { getEvent } from "./api";
import type { SomoimEvent } from "./types";

const EVENT_STATUS_REFRESH_INTERVAL_MS = 15_000;

export const useEventDetail = (eventId?: string) => {
  const [eventRecord, setEventRecord] = useState<SomoimEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshEventRecord = useCallback(async () => {
    if (!eventId) {
      return;
    }

    const latestEvent = await getEvent(eventId);
    setEventRecord(latestEvent);
  }, [eventId]);

  useEffect(() => {
    if (!eventId) {
      return;
    }

    let cancelled = false;

    getEvent(eventId)
      .then((record) => {
        if (!cancelled) {
          setEventRecord(record);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("회차 정보를 불러오지 못했습니다.");
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
  }, [eventId]);

  useEffect(() => {
    if (!eventId || eventRecord?.status === "archived") {
      return;
    }

    let cancelled = false;
    let isRequesting = false;
    let refreshTimeoutId: number | null = null;

    const clearRefreshTimeout = () => {
      if (refreshTimeoutId !== null) {
        window.clearTimeout(refreshTimeoutId);
        refreshTimeoutId = null;
      }
    };

    const scheduleRefresh = () => {
      clearRefreshTimeout();

      if (cancelled || document.hidden) {
        return;
      }

      refreshTimeoutId = window.setTimeout(() => {
        void refreshEventStatus();
      }, EVENT_STATUS_REFRESH_INTERVAL_MS);
    };

    const refreshEventStatus = async () => {
      if (cancelled || isRequesting || document.visibilityState !== "visible") {
        return;
      }

      isRequesting = true;

      try {
        const latestEvent = await getEvent(eventId);

        if (!cancelled) {
          setEventRecord(latestEvent);
        }
      } catch {
        // 자동 갱신 실패 시 현재 화면을 유지합니다.
      } finally {
        isRequesting = false;
        scheduleRefresh();
      }
    };

    scheduleRefresh();

    const handleVisibilityChange = () => {
      clearRefreshTimeout();

      if (document.visibilityState === "visible") {
        void refreshEventStatus();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      clearRefreshTimeout();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [eventId, eventRecord?.status]);

  return {
    eventRecord,
    setEventRecord,
    isLoading,
    error,
    refreshEventRecord,
  };
};
