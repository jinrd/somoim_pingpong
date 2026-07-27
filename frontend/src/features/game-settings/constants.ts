import type { GameSettingInput, MatchFormatInput } from "./types";

export const DEFAULT_GAME_SETTING_INPUT: GameSettingInput = {
  competitionType: "team_league",
  teamSize: 3,
  autoTeamBalance: true,

  individualBestOf: 3,
  individualCountsForRanking: false,
};

export const DEFAULT_MATCH_FORMAT_INPUT: MatchFormatInput = {
  matchType: "singles",
  bestOf: 3,
  countsForRanking: false,
};
