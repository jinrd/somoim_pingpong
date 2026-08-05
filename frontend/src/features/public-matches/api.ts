import { pb } from "../../lib/pocketbase";

import type {
  PublicParticipantMatchesResponse,
  PublicTeamMatchContext,
} from "./types";

export const getMyTeamMatches = async (
  responseToken: string,
): Promise<PublicParticipantMatchesResponse> => {
  return pb.send<PublicParticipantMatchesResponse>(
    "/api/somoim/public/team-matches/mine",
    {
      method: "POST",
      requestKey: null,

      body: {
        responseToken,
      },
    },
  );
};

export const getPublicTeamMatchContext = async (
  teamMatchId: string,
  responseToken: string,
): Promise<PublicTeamMatchContext> => {
  return pb.send<PublicTeamMatchContext>(
    `/api/somoim/public/team-matches/${encodeURIComponent(
      teamMatchId,
    )}/context`,
    {
      method: "POST",
      requestKey: null,

      body: {
        responseToken,
      },
    },
  );
};

export const getMyIndividualMatches = async (
  responseToken: string,
): Promise<PublicParticipantMatchesResponse> => {
  return pb.send<PublicParticipantMatchesResponse>(
    "/api/somoim/public/individual-matches/mine",
    {
      method: "POST",
      requestKey: null,

      body: {
        responseToken,
      },
    },
  );
};
