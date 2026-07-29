/// <reference path="../pb_data/types.d.ts" />

const EVENT_STATUS_DRAFT = "draft";
const EVENT_STATUS_ACTIVE = "active";
const EVENT_STATUS_COMPLETED = "completed";
const EVENT_STATUS_ARCHIVED = "archived";

const isFinishedMatch = function (record) {
  const status = record.getString("status");

  return status === "completed" || status === "cancelled";
};

const findGameSetting = function (dao, eventId) {
  try {
    return dao.findFirstRecordByFilter(
      "event_game_settings",
      "event = {:eventId}",
      {
        eventId,
      },
    );
  } catch (_) {
    return null;
  }
};

/*
 * 저장된 경기 상태를 기준으로 회차 상태를 동기화합니다.
 *
 * - 경기가 하나 이상 있고 모두 완료/취소: completed
 * - 완료 회차에서 결과가 취소되어 미완료 경기가 다시 생김: active
 * - draft는 실제 경기 시작 처리에서만 active로 바뀝니다.
 * - archived는 어떤 자동 처리에서도 되돌리지 않습니다.
 */
const syncEventStatus = function (dao, eventId) {
  const eventRecord = dao.findRecordById("events", eventId);
  const currentStatus = eventRecord.getString("status");

  if (
    currentStatus === EVENT_STATUS_DRAFT ||
    currentStatus === EVENT_STATUS_ARCHIVED
  ) {
    return {
      changed: false,
      status: currentStatus,
      version: eventRecord.getInt("version"),
    };
  }

  const gameSetting = findGameSetting(dao, eventId);

  if (!gameSetting || gameSetting.getString("status") !== "confirmed") {
    return {
      changed: false,
      status: currentStatus,
      version: eventRecord.getInt("version"),
    };
  }

  const competitionType = gameSetting.getString("competition_type");
  const collectionName =
    competitionType === "team_league"
      ? "team_matches"
      : competitionType === "individual_singles"
        ? "individual_matches"
        : "";

  if (!collectionName) {
    return {
      changed: false,
      status: currentStatus,
      version: eventRecord.getInt("version"),
    };
  }

  const matches = dao.findRecordsByFilter(
    collectionName,
    "game_setting = {:gameSettingId}",
    "",
    500,
    0,
    {
      gameSettingId: gameSetting.id,
    },
  );

  if (matches.length === 0) {
    return {
      changed: false,
      status: currentStatus,
      version: eventRecord.getInt("version"),
    };
  }

  const allMatchesFinished = matches.every(isFinishedMatch);
  const nextStatus = allMatchesFinished
    ? EVENT_STATUS_COMPLETED
    : EVENT_STATUS_ACTIVE;

  if (currentStatus === nextStatus) {
    return {
      changed: false,
      status: currentStatus,
      version: eventRecord.getInt("version"),
    };
  }

  eventRecord.set("status", nextStatus);
  eventRecord.set("version", eventRecord.getInt("version") + 1);
  dao.saveRecord(eventRecord);

  const nextOperationStatus = allMatchesFinished
    ? "completed"
    : "in_progress";

  if (gameSetting.getString("operation_status") !== nextOperationStatus) {
    gameSetting.set("operation_status", nextOperationStatus);
    dao.saveRecord(gameSetting);
  }

  return {
    changed: true,
    status: nextStatus,
    version: eventRecord.getInt("version"),
  };
};

module.exports = Object.freeze({
  syncEventStatus,
});
