/// <reference path="../pb_data/types.d.ts" />

const serializeEvent = function (record) {
  return {
    id: record.id,
    collectionId: "somoim_events00",
    collectionName: "events",
    title: record.getString("title"),
    event_date: record.getString("event_date"),
    status: record.getString("status"),
    notice: record.getString("notice"),
    participation_status: record.getString("participation_status"),
    participation_closed_at: record.getString("participation_closed_at"),
    public_access_enabled: record.getBool("public_access_enabled"),
    public_expires_at: record.getString("public_expires_at"),
    created_by: record.getString("created_by"),
    version: record.getInt("version"),
    created: record.getString("created"),
    updated: record.getString("updated"),
  };
};

const assertExpectedVersion = function (record, expectedVersion) {
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw new BadRequestError("회차 버전 정보가 올바르지 않습니다.");
  }

  if (record.getInt("version") !== expectedVersion) {
    throw new ApiError(
      409,
      "다른 운영진이 회차를 먼저 변경했습니다. 최신 정보를 다시 불러와 주세요.",
    );
  }
};

module.exports = Object.freeze({
  assertExpectedVersion,
  serializeEvent,
});
