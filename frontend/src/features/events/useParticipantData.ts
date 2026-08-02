import { useCallback, useEffect, useState } from "react";

import { DEFAULT_RANK_SETTINGS } from "../../config/domain";
import {
  getMembers,
  getRankSettings,
  type Member,
  type RankSettingsInput,
} from "../members/api";
import { checkMatchIntegrity, getEventParticipants } from "./api";
import { excludeRegisteredMembers } from "./participantUtils";
import type { EventParticipantWithMember } from "./types";

export default function useParticipantData(eventId: string) {
  const [participants, setParticipants] = useState<
    EventParticipantWithMember[]
  >([]);
  const [availableMembers, setAvailableMembers] = useState<Member[]>([]);
  const [rankSettings, setRankSettings] = useState<RankSettingsInput>(
    DEFAULT_RANK_SETTINGS,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [hasStartedMatches, setHasStartedMatches] = useState(false);
  const [error, setError] = useState("");

  const refreshParticipants = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [participantRecords, memberRecords, settings, integrity] =
        await Promise.all([
          getEventParticipants(eventId),
          getMembers(),
          getRankSettings(),
          checkMatchIntegrity(eventId),
        ]);

      setParticipants(participantRecords);
      setAvailableMembers(
        excludeRegisteredMembers(memberRecords, participantRecords),
      );
      setRankSettings(settings ?? DEFAULT_RANK_SETTINGS);
      setHasStartedMatches(integrity.hasInProgressOrCompletedMatches);
    } catch {
      setError("참석자 정보를 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshParticipants();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [refreshParticipants]);

  return {
    participants,
    availableMembers,
    rankSettings,
    isLoading,
    hasStartedMatches,
    error,
    setParticipants,
    setError,
    refreshParticipants,
  };
}
