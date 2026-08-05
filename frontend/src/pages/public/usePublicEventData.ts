import { useCallback, useEffect, useState } from "react";

import { ClientResponseError } from "pocketbase";

import { getPublicEvent } from "../../features/events/api";
import type { PublicEventResponse } from "../../features/events/types";

const getPublicErrorMessage = (error: unknown): string => {
  if (error instanceof ClientResponseError) {
    if (error.status === 404) {
      return (
        error.response.message || "유효하지 않거나 만료된 참석 링크입니다."
      );
    }

    return error.response.message || "회차 정보를 불러오지 못했습니다.";
  }

  return "서버에 연결하지 못했습니다.";
};

export default function usePublicEventData(token?: string) {
  const [response, setResponse] = useState<PublicEventResponse | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(token));
  const [error, setError] = useState("");

  const loadEvent = useCallback(async () => {
    if (!token) {
      setResponse(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const result = await getPublicEvent(token);
      setResponse(result);
    } catch (caughtError) {
      setResponse(null);
      setError(getPublicErrorMessage(caughtError));
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    getPublicEvent(token)
      .then((result) => {
        if (!cancelled) {
          setResponse(result);
          setError("");
        }
      })
      .catch((caughtError) => {
        if (!cancelled) {
          setResponse(null);
          setError(getPublicErrorMessage(caughtError));
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
  }, [token]);

  return {
    response,
    isLoading,
    error,
    reload: loadEvent,
  };
}
