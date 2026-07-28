import { pb } from "../../lib/pocketbase";

import type { PublicMatchResultContext, SubmitMatchResultInput } from "./types";

export const getTeamGameResultContext = async (
  matchGameId: string,
  responseToken: string,
): Promise<PublicMatchResultContext> => {
  return pb.send<PublicMatchResultContext>(
    `/api/somoim/public/match-games/${encodeURIComponent(
      matchGameId,
    )}/result/context`,
    {
      method: "POST",
      requestKey: null,

      body: {
        responseToken,
      },
    },
  );
};

export const submitTeamGameResult = async (
  matchGameId: string,
  input: SubmitMatchResultInput,
): Promise<PublicMatchResultContext> => {
  return pb.send<PublicMatchResultContext>(
    `/api/somoim/public/match-games/${encodeURIComponent(matchGameId)}/result`,
    {
      method: "POST",
      requestKey: null,
      body: input,
    },
  );
};

export const getIndividualMatchResultContext = async (
  individualMatchId: string,
  responseToken: string,
): Promise<PublicMatchResultContext> => {
  return pb.send<PublicMatchResultContext>(
    `/api/somoim/public/individual-matches/${encodeURIComponent(
      individualMatchId,
    )}/result/context`,
    {
      method: "POST",
      requestKey: null,

      body: {
        responseToken,
      },
    },
  );
};

export const submitIndividualMatchResult = async (
  individualMatchId: string,
  input: SubmitMatchResultInput,
): Promise<PublicMatchResultContext> => {
  return pb.send<PublicMatchResultContext>(
    `/api/somoim/public/individual-matches/${encodeURIComponent(
      individualMatchId,
    )}/result`,
    {
      method: "POST",
      requestKey: null,
      body: input,
    },
  );
};
