import type { Dispatch, SetStateAction } from "react";

import type { EventGameSetting } from "../game-settings/types";
import { generateTeamFormation } from "./generateTeamFormation";
import { cloneTeams, getTeamFormationErrorMessage } from "./teamFormationUtils";
import type {
  TeamDraft,
  TeamFormationContext,
  TeamFormationMethod,
} from "./types";

interface Params {
  setting: EventGameSetting | null;
  context: TeamFormationContext | null;
  teams: TeamDraft[];
  history: TeamDraft[][];
  method: TeamFormationMethod;
  setTeams: Dispatch<SetStateAction<TeamDraft[]>>;
  setHistory: Dispatch<SetStateAction<TeamDraft[][]>>;
  setWarnings: Dispatch<SetStateAction<string[]>>;
  setIsDirty: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string>>;
  setMessage: Dispatch<SetStateAction<string>>;
}

export default function useTeamFormationEditor({
  setting,
  context,
  teams,
  history,
  method,
  setTeams,
  setHistory,
  setWarnings,
  setIsDirty,
  setError,
  setMessage,
}: Params) {
  const rememberCurrentTeams = () => {
    if (teams.length === 0) {
      return;
    }

    setHistory((currentHistory) => [
      ...currentHistory.slice(-9),
      cloneTeams(teams),
    ]);
  };

  const handleGenerate = () => {
    if (!context) {
      return;
    }

    try {
      const result = generateTeamFormation({
        participants: context.participants,
        targetTeamSize: setting?.team_size ?? 1,
        method,
      });

      rememberCurrentTeams();
      setTeams(result.teams);
      setWarnings(result.warnings);
      setIsDirty(true);
      setError("");
      setMessage(
        `${result.participantCount}명을 ${result.teamCount}팀으로 편성했습니다.`,
      );
    } catch (caughtError) {
      setError(
        getTeamFormationErrorMessage(
          caughtError,
          "팀을 자동 편성하지 못했습니다.",
        ),
      );
    }
  };

  const handleMoveMember = (participantId: string, targetTeamKey: string) => {
    const sourceTeam = teams.find((team) =>
      team.members.some((member) => member.participantId === participantId),
    );

    if (!sourceTeam || sourceTeam.key === targetTeamKey) {
      return;
    }

    const member = sourceTeam.members.find(
      (currentMember) => currentMember.participantId === participantId,
    );

    if (!member) {
      return;
    }

    rememberCurrentTeams();

    const nextTeams = teams.map((team) => {
      if (team.key === sourceTeam.key) {
        return {
          ...team,
          members: team.members.filter(
            (currentMember) => currentMember.participantId !== participantId,
          ),
        };
      }

      if (team.key === targetTeamKey) {
        return {
          ...team,
          members: [...team.members, member],
        };
      }

      return team;
    });

    setTeams(nextTeams);
    setWarnings(
      nextTeams.some((team) => team.members.length === 0)
        ? ["팀원이 없는 팀은 저장할 수 없습니다."]
        : [],
    );
    setIsDirty(true);
    setError("");
    setMessage(`${member.displayName} 님을 이동했습니다.`);
  };

  const handleUndo = () => {
    const previousTeams = history[history.length - 1];

    if (!previousTeams) {
      return;
    }

    setTeams(cloneTeams(previousTeams));
    setHistory((currentHistory) => currentHistory.slice(0, -1));
    setWarnings([]);
    setIsDirty(true);
    setError("");
    setMessage("직전 편성으로 되돌렸습니다.");
  };

  const handleTeamNameChange = (teamKey: string, name: string) => {
    setTeams((currentTeams) =>
      currentTeams.map((team) =>
        team.key === teamKey
          ? {
              ...team,
              name,
            }
          : team,
      ),
    );
    setIsDirty(true);
  };

  return {
    handleGenerate,
    handleMoveMember,
    handleUndo,
    handleTeamNameChange,
  };
}
