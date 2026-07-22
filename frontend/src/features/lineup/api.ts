import { pb } from "../../lib/pocketbase";

import type {
  PublicLineupContext,
  PublicParticipantMatchesResponse,
  SavePublicLineupInput,
} from "./types";

export const getMyTeamMatches = async (
  responseToken: string,
): Promise<PublicParticipantMatchesResponse> => {
  return pb.send<PublicParticipantMatchesResponse>(
    "/api/somoim/public/team-matches/mine",
    {
      method: "POST",
      body: {
        responseToken,
      },
    },
  );
};

export const getPublicLineupContext = async (
  teamMatchId: string,
  responseToken: string,
): Promise<PublicLineupContext> => {
  return pb.send<PublicLineupContext>(
    `/api/somoim/public/team-matches/${encodeURIComponent(
      teamMatchId,
    )}/lineup/context`,
    {
      method: "POST",
      body: {
        responseToken,
      },
    },
  );
};

export const savePublicLineup = async (
  teamMatchId: string,
  input: SavePublicLineupInput,
): Promise<PublicLineupContext> => {
  return pb.send<PublicLineupContext>(
    `/api/somoim/public/team-matches/${encodeURIComponent(teamMatchId)}/lineup`,
    {
      method: "PUT",
      body: input,
    },
  );
};
