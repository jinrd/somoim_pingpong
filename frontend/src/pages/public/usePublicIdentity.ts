import { useCallback, useEffect, useState } from "react";

import { refreshPublicParticipantIdentity } from "../../features/events/api";
import {
  loadPublicIdentity,
  removePublicIdentity,
  savePublicIdentity,
} from "../../features/events/publicIdentityStorage";
import type {
  PublicIdentifiedParticipant,
  PublicIdentityResult,
} from "../../features/events/types";

export default function usePublicIdentity(publicToken?: string) {
  const [identity, setIdentityState] = useState<PublicIdentityResult | null>(
    () => {
      const parsedValue = loadPublicIdentity(publicToken);
      if (!parsedValue) {
        return null;
      }

      return {
        ...parsedValue,
        participant: {
          ...parsedValue.participant,
          team: parsedValue.participant.team ?? null,
        },
      };
    },
  );

  const setIdentity = useCallback(
    (nextIdentity: PublicIdentityResult) => {
      if (publicToken) {
        savePublicIdentity(publicToken, nextIdentity);
      }

      setIdentityState(nextIdentity);
    },
    [publicToken],
  );

  const updateParticipant = useCallback(
    (participant: PublicIdentifiedParticipant) => {
      setIdentityState((currentIdentity) => {
        if (!currentIdentity) {
          return null;
        }

        const nextIdentity = {
          ...currentIdentity,
          participant: {
            ...participant,
            team: participant.team ?? currentIdentity.participant.team,
          },
        };

        if (publicToken) {
          savePublicIdentity(publicToken, nextIdentity);
        }

        return nextIdentity;
      });
    },
    [publicToken],
  );

  const clearIdentity = useCallback(() => {
    if (publicToken) {
      removePublicIdentity(publicToken);
    }

    setIdentityState(null);
  }, [publicToken]);

  const responseToken = identity?.responseToken ?? "";

  const refreshIdentity = useCallback(async () => {
    if (!responseToken) {
      return;
    }

    try {
      const refreshedIdentity = await refreshPublicParticipantIdentity(
        responseToken,
      );

      setIdentity(refreshedIdentity);
    } catch {
      // 일시적인 갱신 실패 시 저장된 본인 확인을 유지합니다.
    }
  }, [responseToken, setIdentity]);

  useEffect(() => {
    if (!responseToken) {
      return;
    }

    const handlePageResume = () => {
      if (document.visibilityState === "visible") {
        void refreshIdentity();
      }
    };

    const initialRefreshId = window.setTimeout(() => {
      void refreshIdentity();
    }, 0);
    window.addEventListener("pageshow", handlePageResume);
    document.addEventListener("visibilitychange", handlePageResume);

    return () => {
      window.clearTimeout(initialRefreshId);
      window.removeEventListener("pageshow", handlePageResume);
      document.removeEventListener("visibilitychange", handlePageResume);
    };
  }, [responseToken, refreshIdentity]);

  return {
    identity,
    setIdentity,
    updateParticipant,
    clearIdentity,
    refreshIdentity,
  };
}
