import { pb } from "../../lib/pocketbase";

import type { StandingsResponse } from "./types";

export const getAdminStandings = async (
  gameSettingId: string,
): Promise<StandingsResponse> => {
  return pb.send<StandingsResponse>(
    `/api/somoim/admin/game-settings/${encodeURIComponent(
      gameSettingId,
    )}/standings`,
    {
      method: "GET",
      requestKey: null,
    },
  );
};

export const getPublicStandings = async (
  responseToken: string,
): Promise<StandingsResponse> => {
  return pb.send<StandingsResponse>("/api/somoim/public/standings", {
    method: "POST",
    requestKey: null,

    body: {
      responseToken,
    },
  });
};
