import { useEffect } from "react";

interface Params {
  refresh: () => Promise<void>;
  intervalMs: number;
  enabled?: boolean;
}

export default function usePublicMatchPolling({
  refresh,
  intervalMs,
  enabled = true,
}: Params) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    let isRequesting = false;

    const refreshWhenVisible = async () => {
      if (cancelled || isRequesting || document.visibilityState !== "visible") {
        return;
      }

      isRequesting = true;

      try {
        await refresh();
      } finally {
        isRequesting = false;
      }
    };

    const intervalId = window.setInterval(() => {
      void refreshWhenVisible();
    }, intervalMs);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshWhenVisible();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [intervalMs, refresh, enabled]);
}
