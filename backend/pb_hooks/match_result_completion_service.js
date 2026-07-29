/// <reference path="../pb_data/types.d.ts" />

const TARGET_TYPE_TEAM_GAME = "team_game";
const TARGET_TYPE_INDIVIDUAL_MATCH = "individual_match";

const RESULT_STATUS_CONFIRMED = "confirmed";

/*
 * 하나의 세부 결과가 확정된 뒤 실행해야 하는 후속 처리를 한곳에 모읍니다.
 *
 * 참가자가 서로 같은 결과를 입력한 경우와 운영진이 대신 확정한 경우가
 * 반드시 같은 경기 진행 흐름을 타도록 하기 위한 서비스입니다.
 */
const completeConfirmedResult = function (dao, targetType, targetRecord) {
  const operationService = require(`${__hooks}/match_operation_service.js`);
  const eventStatusService = require(`${__hooks}/event_status_service.js`);

  let eventId = "";

  if (targetType === TARGET_TYPE_TEAM_GAME) {
    const teamMatchId = targetRecord.getString("team_match");
    const matchGameRecords = dao.findRecordsByFilter(
      "match_games",
      "team_match = {:teamMatchId}",
      "sequence",
      100,
      0,
      {
        teamMatchId,
      },
    );

    const allGamesConfirmed =
      matchGameRecords.length > 0 &&
      matchGameRecords.every(
        (matchGameRecord) =>
          matchGameRecord.getString("status") === "completed" &&
          matchGameRecord.getString("result_status") ===
            RESULT_STATUS_CONFIRMED,
      );

    const teamMatchRecord = dao.findRecordById(
      "team_matches",
      teamMatchId,
    );

    eventId = teamMatchRecord.getString("event");

    if (
      allGamesConfirmed &&
      teamMatchRecord.getString("status") !== "completed"
    ) {
      teamMatchRecord.set("status", "completed");
      teamMatchRecord.set("completed_at", new Date().toISOString());
      teamMatchRecord.set("version", teamMatchRecord.getInt("version") + 1);
      dao.saveRecord(teamMatchRecord);

      operationService.advanceTeamRound(
        dao,
        teamMatchRecord.getString("game_setting"),
      );
    }
  } else if (targetType === TARGET_TYPE_INDIVIDUAL_MATCH) {
    eventId = targetRecord.getString("event");

    operationService.assignIndividualMatches(
      dao,
      targetRecord.getString("game_setting"),
    );
  } else {
    throw new ApiError(400, "지원하지 않는 경기 종류입니다.");
  }

  return eventStatusService.syncEventStatus(dao, eventId);
};

module.exports = Object.freeze({
  completeConfirmedResult,
});
