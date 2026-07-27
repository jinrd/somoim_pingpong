import type { RecordModel } from "pocketbase";

export type CompetitionType = "team_league" | "individual_singles";

export type GameSettingStatus = "draft" | "confirmed";

export type MatchType = "singles" | "doubles";

export interface EventGameSetting extends RecordModel {
  event: string;
  competition_type: CompetitionType;

  // 개인 단식 리그에서는 0
  team_size: number;

  auto_team_balance: boolean;

  individual_best_of: number;
  individual_counts_for_ranking: boolean;

  status: GameSettingStatus;
  version: number;
}

export interface EventMatchFormat extends RecordModel {
  game_setting: string;
  sequence: number;
  match_type: MatchType;
  best_of: number;
  counts_for_ranking: boolean;
}

export interface GameSettingInput {
  competitionType: CompetitionType;
  teamSize: number;
  autoTeamBalance: boolean;

  individualBestOf: number;
  individualCountsForRanking: boolean;

}

export interface MatchFormatInput {
  id?: string;
  matchType: MatchType;
  bestOf: number;
  countsForRanking: boolean;
}

export interface MatchFormatDraft extends MatchFormatInput {
  key: string;
}

export interface EventGameConfiguration {
  setting: EventGameSetting | null;
  matchFormats: EventMatchFormat[];
}
export const COMPETITION_TYPE_LABELS: Record<CompetitionType, string> = {
  team_league: "팀 리그전",
  individual_singles: "개인 단식 풀리그",
};

export const MATCH_TYPE_LABELS: Record<MatchType, string> = {
  singles: "단식",
  doubles: "복식",
};
