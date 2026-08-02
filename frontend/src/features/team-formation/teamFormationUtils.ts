import type { TeamDraft } from "./types";

export const cloneTeams = (teams: TeamDraft[]): TeamDraft[] =>
  teams.map((team) => ({
    ...team,
    members: team.members.map((member) => ({
      ...member,
    })),
  }));

export const getTeamFormationErrorMessage = (
  error: unknown,
  fallback: string,
): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
};
