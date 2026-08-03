import { ClientResponseError } from "pocketbase";

import { pb } from "../../lib/pocketbase";
import { isValidTeamMatchFormatCount } from "./gameSettingUtils";

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
    validatePositiveInteger(input.individualTableCount, "사용 테이블 수");
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
export const saveEventGameSettingDraft = async (
  eventId: string,
  input: GameSettingInput,
  expectedVersion: number,
): Promise<EventGameSetting> => {
  validateGameSettingInput(input);

  return pb.send<EventGameSetting>(
    `/api/somoim/admin/events/${encodeURIComponent(eventId)}/game-setting`,
    {
      method: "PUT",
      body: {
        competitionType: input.competitionType,
        teamSize: input.teamSize,
        autoTeamBalance: input.autoTeamBalance,
        individualBestOf: input.individualBestOf,
        individualCountsForRanking: input.individualCountsForRanking,
        expectedVersion,
        individualTableCount: input.individualTableCount,
      },
    },
  );
};

export const confirmEventGameSetting = async (
  settingId: string,
  expectedVersion: number,
): Promise<EventGameSetting> => {
  return pb.send<EventGameSetting>(
    `/api/somoim/admin/game-settings/${encodeURIComponent(settingId)}/confirm`,
    {
      method: "POST",
      body: { expectedVersion },
    },
  );
};

export const unlockEventGameSetting = async (
  settingId: string,
  expectedVersion: number,
): Promise<EventGameSetting> => {
  return pb.send<EventGameSetting>(
    `/api/somoim/admin/game-settings/${encodeURIComponent(settingId)}/unlock`,
    {
      method: "POST",
      body: { expectedVersion },
    },
  );
};

/**
 * 세부 경기 전체 배열을 한 번의 요청으로 저장합니다.
 * 배열에 없는 기존 경기는 삭제되고 배열 순서대로 sequence가 부여됩니다.
 */
export const saveMatchFormats = async (
  gameSettingId: string,
  formats: MatchFormatInput[],
): Promise<EventMatchFormat[]> => {
  if (!isValidTeamMatchFormatCount(formats.length)) {
    throw new Error(
      "팀 대결 세부 경기 수는 1개, 3개, 5개 중에서 선택해 주세요.",
    );
  }

  formats.forEach(validateMatchFormatInput);

  return pb.send<EventMatchFormat[]>(
    `/api/somoim/admin/game-settings/${encodeURIComponent(gameSettingId)}/match-formats`,
    {
      method: "PUT",
      body: { formats },
    },
  );
};
