import { ClientResponseError } from "pocketbase";

import { pb } from "../../lib/pocketbase";

import type {
  EventGameConfiguration,
  EventGameSetting,
  EventMatchFormat,
  GameSettingInput,
  MatchFormatInput,
} from "./types";

const GAME_SETTINGS_COLLECTION = "event_game_settings";

const MATCH_FORMATS_COLLECTION = "event_match_formats";

const validatePositiveInteger = (value: number, fieldName: string): number => {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${fieldName}은 1 이상의 정수여야 합니다.`);
  }

  return value;
};

const validateBestOf = (bestOf: number): number => {
  validatePositiveInteger(bestOf, "경기 판수");

  if (bestOf % 2 === 0) {
    throw new Error("경기 판수는 승자를 결정할 수 있도록 홀수여야 합니다.");
  }

  return bestOf;
};

const validateGameSettingInput = (input: GameSettingInput): void => {
  if (input.competitionType === "team_league") {
    validatePositiveInteger(input.teamSize, "팀당 인원");
  }

  if (input.competitionType === "individual_singles") {
    validateBestOf(input.individualBestOf);
  }
};

const validateMatchFormatInput = (input: MatchFormatInput): void => {
  validateBestOf(input.bestOf);
};

/**
 * 회차의 게임 설정 한 건을 조회합니다.
 */
export const getEventGameSetting = async (
  eventId: string,
): Promise<EventGameSetting | null> => {
  try {
    return await pb
      .collection(GAME_SETTINGS_COLLECTION)
      .getFirstListItem<EventGameSetting>(
        pb.filter("event = {:eventId}", {
          eventId,
        }),
      );
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) {
      return null;
    }

    throw error;
  }
};

/**
 * 게임 설정에 포함된 세부 경기 형식을 조회합니다.
 */
export const getMatchFormats = async (
  gameSettingId: string,
): Promise<EventMatchFormat[]> => {
  return pb.collection(MATCH_FORMATS_COLLECTION).getFullList<EventMatchFormat>({
    filter: pb.filter("game_setting = {:gameSettingId}", {
      gameSettingId,
    }),
    sort: "sequence",
  });
};

/**
 * 회차 게임 설정과 세부 경기 형식을 함께 조회합니다.
 */
export const getEventGameConfiguration = async (
  eventId: string,
): Promise<EventGameConfiguration> => {
  const setting = await getEventGameSetting(eventId);

  if (!setting) {
    return {
      setting: null,
      matchFormats: [],
    };
  }

  const matchFormats = await getMatchFormats(setting.id);

  return {
    setting,
    matchFormats,
  };
};

/**
 * 새 회차 게임 설정을 생성합니다.
 */
export const createEventGameSetting = async (
  eventId: string,
  input: GameSettingInput,
): Promise<EventGameSetting> => {
  validateGameSettingInput(input);

  return pb.collection(GAME_SETTINGS_COLLECTION).create<EventGameSetting>({
    event: eventId,

    competition_type: input.competitionType,

    team_size: input.competitionType === "team_league" ? input.teamSize : 0,

    auto_team_balance:
      input.competitionType === "team_league" ? input.autoTeamBalance : false,

    individual_best_of: input.individualBestOf,

    individual_counts_for_ranking: input.individualCountsForRanking,

    status: input.status,
    version: 1,
  });
};

/**
 * 기존 회차 게임 설정을 수정합니다.
 */
export const updateEventGameSetting = async (
  settingId: string,
  input: GameSettingInput,
  expectedVersion: number,
): Promise<EventGameSetting> => {
  validateGameSettingInput(input);

  const currentSetting = await pb
    .collection(GAME_SETTINGS_COLLECTION)
    .getOne<EventGameSetting>(settingId);

  if (currentSetting.version !== expectedVersion) {
    throw new Error(
      "다른 운영진이 먼저 게임 설정을 변경했습니다. 최신 정보를 다시 불러와 주세요.",
    );
  }

  return pb
    .collection(GAME_SETTINGS_COLLECTION)
    .update<EventGameSetting>(settingId, {
      competition_type: input.competitionType,

      team_size: input.competitionType === "team_league" ? input.teamSize : 0,

      auto_team_balance:
        input.competitionType === "team_league" ? input.autoTeamBalance : false,

      individual_best_of: input.individualBestOf,

      individual_counts_for_ranking: input.individualCountsForRanking,

      status: input.status,
      version: currentSetting.version + 1,
    });
};

/**
 * 세부 경기 전체 배열을 한 번의 요청으로 저장합니다.
 * 배열에 없는 기존 경기는 삭제되고 배열 순서대로 sequence가 부여됩니다.
 */
export const saveMatchFormats = async (
  gameSettingId: string,
  formats: MatchFormatInput[],
): Promise<EventMatchFormat[]> => {
  formats.forEach(validateMatchFormatInput);

  return pb.send<EventMatchFormat[]>(
    `/api/somoim/admin/game-settings/${encodeURIComponent(gameSettingId)}/match-formats`,
    {
      method: "PUT",
      body: { formats },
    },
  );
};
