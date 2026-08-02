import { useState, type Dispatch, type SetStateAction } from "react";

import type { EventGameSetting } from "../game-settings/types";
import { saveTeamFormation, unlockTeamFormation } from "./api";
import { cloneTeams, getTeamFormationErrorMessage } from "./teamFormationUtils";
import type {
  TeamDraft,
  TeamFormationContext,
  TeamFormationMethod,
  TeamFormationStatus,
} from "./types";

interface Params {
  setting: EventGameSetting | null;
  context: TeamFormationContext | null;
  teams: TeamDraft[];
  method: TeamFormationMethod;
  status: TeamFormationStatus;
  setContext: Dispatch<SetStateAction<TeamFormationContext | null>>;
  setTeams: Dispatch<SetStateAction<TeamDraft[]>>;
  setMethod: Dispatch<SetStateAction<TeamFormationMethod>>;
  setStatus: Dispatch<SetStateAction<TeamFormationStatus>>;
  setWarnings: Dispatch<SetStateAction<string[]>>;
  setIsDirty: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string>>;
  setMessage: Dispatch<SetStateAction<string>>;
  reloadFormation: () => Promise<void>;
  onFormationChanged?: (status: TeamFormationStatus | null) => void;
  onScheduleReset?: () => void;
}

export default function useTeamFormationActions({
  setting,
  context,
  teams,
  method,
  status,
  setContext,
  setTeams,
  setMethod,
  setStatus,
  setWarnings,
  setIsDirty,
  setError,
  setMessage,
  reloadFormation,
  onFormationChanged,
  onScheduleReset,
}: Params) {
  const [isWorking, setIsWorking] = useState(false);
  const [isConfirmFormationOpen, setConfirmFormationOpen] = useState(false);

  const handleSave = async (nextStatus: TeamFormationStatus) => {
    if (!context || !setting) {
      return;
    }

    if (nextStatus === "confirmed") {
      setConfirmFormationOpen(false);
    }

    setIsWorking(true);
    setError("");
    setMessage("");

    try {
      const saved = await saveTeamFormation(setting.id, {
        method,
        status: nextStatus,
        expectedVersion: context.formation?.version ?? 0,
        teams: teams.map((team) => ({
          id: team.id,
          name: team.name,
          participantIds: team.members.map((member) => member.participantId),
        })),
      });

      setContext(saved);
      setTeams(cloneTeams(saved.teams));
      setMethod(saved.formation?.method ?? method);
      setStatus(saved.formation?.status ?? status);
      setIsDirty(false);
      setWarnings([]);

      const savedStatus = saved.formation?.status ?? null;
      onFormationChanged?.(savedStatus);

      setMessage(
        nextStatus === "confirmed"
          ? "팀 편성을 최종 확정했습니다."
          : "팀 편성 초안을 저장했습니다.",
      );
    } catch (caughtError) {
      setError(
        getTeamFormationErrorMessage(
          caughtError,
          "팀 편성을 저장하지 못했습니다.",
        ),
      );
    } finally {
      setIsWorking(false);
    }
  };

  const handleUnlock = async () => {
    if (!setting || !context?.formation || status !== "confirmed") {
      return;
    }

    if (
      !window.confirm(
        "팀 편성 수정을 시작할까요?\n\n저장된 대진표와 라인업이 모두 초기화되며 되돌릴 수 없습니다. 현재 팀 편성은 초안으로 유지됩니다.",
      )
    ) {
      return;
    }

    setIsWorking(true);
    setError("");
    setMessage("");

    try {
      await unlockTeamFormation(setting.id, context.formation.version);

      onScheduleReset?.();
      onFormationChanged?.("draft");
      await reloadFormation();

      setMessage(
        "대진표와 라인업을 초기화하고 팀 편성을 초안으로 전환했습니다.",
      );
    } catch (caughtError) {
      setError(
        getTeamFormationErrorMessage(
          caughtError,
          "팀 편성 수정을 시작하지 못했습니다.",
        ),
      );
    } finally {
      setIsWorking(false);
    }
  };

  const openConfirmFormation = () => {
    setError("");
    setMessage("");
    setConfirmFormationOpen(true);
  };

  return {
    isWorking,
    isConfirmFormationOpen,
    handleSave,
    handleUnlock,
    openConfirmFormation,
    closeConfirmFormation: () => setConfirmFormationOpen(false),
  };
}
