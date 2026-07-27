function findGameSetting(dao, eventId) {
  try {
    return dao.findFirstRecordByFilter(
      "event_game_settings",
      "event = {:eventId}",
      { eventId },
    );
  } catch {
    return null;
  }
}

function assertRegistrationOpen(eventRecord) {
  if (eventRecord.getString("participation_status") !== "open") {
    throw new BadRequestError(
      "참가 신청이 최종 마감되어 참석자를 추가하거나 삭제할 수 없습니다.",
    );
  }
}

function assertRegistrationClosed(eventRecord) {
  if (eventRecord.getString("participation_status") !== "closed") {
    throw new BadRequestError(
      "참가 신청을 최종 마감한 후 게임 설정을 진행해 주세요.",
    );
  }
}

function getUndecidedCount(dao, eventId) {
  return dao.findRecordsByFilter(
    "event_participants",
    [
      "event = {:eventId}",
      "game_participation_status = {:status}",
    ].join(" && "),
    "",
    500,
    0,
    {
      eventId,
      status: "undecided",
    },
  ).length;
}

function assertNoUndecidedParticipants(dao, eventId) {
  const undecidedCount = getUndecidedCount(dao, eventId);

  if (undecidedCount > 0) {
    throw new BadRequestError(
      `참가 상태가 미정인 참석자 ${undecidedCount}명이 있습니다. 모든 상태를 확정한 후 진행해 주세요.`,
    );
  }
}

function assertSetupEditable(dao, eventId) {
  const matchIntegrity = require(`${__hooks}/event_match_integrity.js`);

  if (matchIntegrity.hasStartedOrCompletedMatches(dao, eventId)) {
    throw new BadRequestError(
      "이미 시작했거나 완료된 경기가 있어 참석자 및 경기 구성을 변경할 수 없습니다.",
    );
  }
}

function deleteGameConfiguration(dao, eventId) {
  const gameSetting = findGameSetting(dao, eventId);

  if (!gameSetting) {
    return false;
  }

  dao.deleteRecord(gameSetting);
  return true;
}

function hasDownstreamConfiguration(dao, gameSettingId) {
  const lookups = [
    ["team_formations", "game_setting"],
    ["team_matches", "game_setting"],
    ["individual_matches", "game_setting"],
  ];

  return lookups.some(
    ([collectionName, fieldName]) =>
      dao.findRecordsByFilter(
        collectionName,
        `${fieldName} = {:gameSettingId}`,
        "",
        1,
        0,
        { gameSettingId },
      ).length > 0,
  );
}

function deleteTeamSchedules(dao, formationId) {
  const teamMatches = dao.findRecordsByFilter(
    "team_matches",
    "formation = {:formationId}",
    "",
    500,
    0,
    { formationId },
  );

  teamMatches.forEach((matchRecord) => {
    dao.deleteRecord(matchRecord);
  });

  return teamMatches.length > 0;
}

function toGameSettingDto(record) {
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    event: record.getString("event"),
    competition_type: record.getString("competition_type"),
    team_size: record.getInt("team_size"),
    auto_team_balance: record.getBool("auto_team_balance"),
    individual_best_of: record.getInt("individual_best_of"),
    individual_counts_for_ranking: record.getBool(
      "individual_counts_for_ranking",
    ),
    status: record.getString("status"),
    version: record.getInt("version"),
  };
}

function toParticipantDto(record) {
  return {
    id: record.id,
    event: record.getString("event"),
    participant_type: record.getString("participant_type"),
    member: record.getString("member"),
    guest_name: record.getString("guest_name"),
    display_name: record.getString("display_name"),
    rank_snapshot: record.getInt("rank_snapshot"),
    game_participation_status: record.getString(
      "game_participation_status",
    ),
    participation_responded_at: record.getString(
      "participation_responded_at",
    ),
    version: record.getInt("version"),
  };
}

module.exports = {
  assertNoUndecidedParticipants,
  assertRegistrationClosed,
  assertRegistrationOpen,
  assertSetupEditable,
  deleteGameConfiguration,
  deleteTeamSchedules,
  findGameSetting,
  getUndecidedCount,
  hasDownstreamConfiguration,
  toGameSettingDto,
  toParticipantDto,
};
