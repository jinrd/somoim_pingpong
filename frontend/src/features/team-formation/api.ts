import { pb } from "../../lib/pocketbase";

import type { SaveTeamFormationInput, TeamFormationContext } from "./types";

const validateSaveInput = (input: SaveTeamFormationInput): void => {
  if (input.teams.length === 0) {
    throw new Error("저장할 팀 편성이 없습니다.");
  }

  const participantIds = input.teams.flatMap((team) => team.participantIds);

  if (new Set(participantIds).size !== participantIds.length) {
    throw new Error("한 참가자가 여러 팀에 포함되어 있습니다.");
  }

  input.teams.forEach((team, index) => {
    if (!team.name.trim()) {
      throw new Error(`${index + 1}번째 팀 이름을 입력해 주세요.`);
    }

    if (team.participantIds.length === 0) {
      throw new Error(`${team.name}에 팀원이 없습니다.`);
    }
  });
};

export const getTeamFormationContext = async (
  gameSettingId: string,
): Promise<TeamFormationContext> => {
  return pb.send<TeamFormationContext>(
    `/api/somoim/admin/game-settings/${encodeURIComponent(gameSettingId)}/team-formation`,
    {
      method: "GET",
    },
  );
};

export const saveTeamFormation = async (
  gameSettingId: string,
  input: SaveTeamFormationInput,
): Promise<TeamFormationContext> => {
  validateSaveInput(input);

  return pb.send<TeamFormationContext>(
    `/api/somoim/admin/game-settings/${encodeURIComponent(gameSettingId)}/team-formation`,
    {
      method: "PUT",
      body: {
        method: input.method,
        status: input.status,
        expectedVersion: input.expectedVersion,

        teams: input.teams.map((team) => ({
          id: team.id ?? "",
          name: team.name.trim(),
          participantIds: team.participantIds,
        })),
      },
    },
  );
};
