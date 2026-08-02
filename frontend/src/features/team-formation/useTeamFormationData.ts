import { useCallback, useEffect, useState } from "react";

import type { EventGameSetting } from "../game-settings/types";
import { getTeamFormationContext } from "./api";
import { cloneTeams, getTeamFormationErrorMessage } from "./teamFormationUtils";
import type {
  TeamDraft,
  TeamFormationContext,
  TeamFormationMethod,
  TeamFormationStatus,
} from "./types";

interface Params {
  setting: EventGameSetting | null;
  onFormationChanged?: (status: TeamFormationStatus | null) => void;
}

export default function useTeamFormationData({
  setting,
  onFormationChanged,
}: Params) {
  const [context, setContext] = useState<TeamFormationContext | null>(null);
  const [teams, setTeams] = useState<TeamDraft[]>([]);
  const [history, setHistory] = useState<TeamDraft[][]>([]);
  const [method, setMethod] = useState<TeamFormationMethod>("balanced");
  const [status, setStatus] = useState<TeamFormationStatus>("draft");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const reloadFormation = useCallback(async () => {
    if (
      !setting ||
      setting.competition_type !== "team_league" ||
      setting.status !== "confirmed"
    ) {
      return;
    }

    setIsLoading(true);
    setError("");
    setMessage("");

    try {
      const loaded = await getTeamFormationContext(setting.id);

      setContext(loaded);
      setTeams(cloneTeams(loaded.teams));
      setHistory([]);
      setWarnings([]);
      setIsDirty(false);

      if (loaded.formation) {
        setMethod(loaded.formation.method);
        setStatus(loaded.formation.status);
        onFormationChanged?.(loaded.formation.status);
      } else {
        setMethod(setting.auto_team_balance ? "balanced" : "random");
        setStatus("draft");
        onFormationChanged?.(null);
      }
    } catch (caughtError) {
      setError(
        getTeamFormationErrorMessage(
          caughtError,
          "팀 편성 정보를 불러오지 못했습니다.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }, [onFormationChanged, setting]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void reloadFormation();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [reloadFormation]);

  return {
    context,
    teams,
    history,
    method,
    status,
    warnings,
    isLoading,
    isDirty,
    error,
    message,
    setContext,
    setTeams,
    setHistory,
    setMethod,
    setStatus,
    setWarnings,
    setIsDirty,
    setError,
    setMessage,
    reloadFormation,
  };
}
