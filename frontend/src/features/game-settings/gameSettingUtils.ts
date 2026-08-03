import type {
  EventGameSetting,
  EventMatchFormat,
  GameSettingInput,
  MatchFormatDraft,
} from "./types";
import { TEAM_MATCH_FORMAT_COUNTS } from "./constants";

export const isValidTeamMatchFormatCount = (count: number): boolean => {
  return TEAM_MATCH_FORMAT_COUNTS.some((allowedCount) => allowedCount === count);
};

export const toGameSettingInput = (
  setting: EventGameSetting,
): GameSettingInput => ({
  competitionType: setting.competition_type,
  teamSize: setting.team_size,
  autoTeamBalance: setting.auto_team_balance,
  individualBestOf: setting.individual_best_of,
  individualCountsForRanking: setting.individual_counts_for_ranking,
  individualTableCount: setting.individual_table_count,
});

export const toMatchFormatDraft = (
  format: EventMatchFormat,
): MatchFormatDraft => ({
  key: format.id,
  id: format.id,
  matchType: format.match_type,
  bestOf: format.best_of,
  countsForRanking: format.counts_for_ranking,
});

export const getGameSettingErrorMessage = (
  error: unknown,
  fallback: string,
): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
};
