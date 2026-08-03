import type { GameSettingInput, MatchFormatInput } from "./types";

export const DEFAULT_GAME_SETTING_INPUT: GameSettingInput = {
  competitionType: "team_league",
  teamSize: 3,
  autoTeamBalance: true,

  individualBestOf: 3,
  individualCountsForRanking: false,
  individualTableCount: 4,
};

export const DEFAULT_MATCH_FORMAT_INPUT: MatchFormatInput = {
  matchType: "singles",
  bestOf: 3,
  countsForRanking: false,
};

export const TEAM_MATCH_FORMAT_COUNTS = [1, 3, 5] as const;
