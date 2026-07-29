/// <reference path="../pb_data/types.d.ts" />

const historyService = require(`${__hooks}/match_result_history_service.js`);

const RESULT_STATUS_CONFIRMED = "confirmed";
const RESULT_STATUS_PENDING = "pending";

const normalizeInput = function (input) {
  const requestId = String(input.requestId || "").trim();
  const expectedVersion = Number(input.expectedVersion);
  const reason = String(input.reason || "").trim();

  if (!requestId || requestId.length > 100) {
    throw new ApiError(400, "요청 식별 정보가 올바르지 않습니다.");
  }

  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw new ApiError(400, "결과 버전 정보가 올바르지 않습니다.");
  }

  if (!reason) {
    throw new ApiError(400, "결과 취소 사유를 입력해 주세요.");
  }

  if (reason.length > 500) {
    throw new ApiError(400, "취소 사유는 500자 이하로 입력해 주세요.");
  }

  return {
    requestId,
    expectedVersion,
    reason,
    adminId: String(input.adminId || ""),
    adminName: String(input.adminName || "관리자"),
  };
};

const deleteGameSubmissions = function (dao, matchGameId) {
  const submissions = dao.findRecordsByFilter(
    "match_result_submissions",
    "match_game = {:matchGameId}",
    "",
    10,
    0,
    {
      matchGameId,
    },
  );

  submissions.forEach((submission) => {
    dao.deleteRecord(submission);
  });
};

const deleteIndividualSubmissions = function (dao, individualMatchId) {
  const submissions = dao.findRecordsByFilter(
    "match_result_submissions",
    "individual_match = {:individualMatchId}",
    "",
    10,
    0,
    {
      individualMatchId,
    },
  );

  submissions.forEach((submission) => {
    dao.deleteRecord(submission);
  });
};

const resetResultFields = function (record) {
  record.set("status", "in_progress");
  record.set("result_status", RESULT_STATUS_PENDING);
  record.set("home_score", null);
  record.set("away_score", null);
  record.set("winner_side", "");
  record.set("result_confirmed_at", "");

  record.set("version", record.getInt("version") + 1);
};

const cancelTeamMatchResult = function (teamMatchId, input) {
  const normalized = normalizeInput(input);

  $app.dao().runInTransaction((txDao) => {
    const previousHistory = historyService.findHistoryByRequestId(
      txDao,
      normalized.requestId,
    );

    if (previousHistory) {
      if (
        previousHistory.getString("target_type") === "team_match" &&
        previousHistory.getString("team_match") === teamMatchId &&
        previousHistory.getString("actor_admin") === normalized.adminId
      ) {
        return;
      }

      throw new ApiError(409, "이미 다른 요청에서 사용된 요청 정보입니다.");
    }

    let teamMatch;

    try {
      teamMatch = txDao.findRecordById("team_matches", teamMatchId);
    } catch {
      throw new ApiError(404, "팀 대결을 찾을 수 없습니다.");
    }

    if (teamMatch.getInt("version") !== normalized.expectedVersion) {
      throw new ApiError(
        409,
        "경기 정보가 변경되었습니다. 새로고침 후 다시 시도해 주세요.",
      );
    }

    /*
     * 다음 라운드가 이미 시작되거나 완료된 경우,
     * 이전 라운드 결과를 취소하면 서로 다른 라운드가 동시에
     * 진행 중이 되는 문제가 발생하므로 취소를 차단합니다.
     */
    const laterStartedMatches = txDao.findRecordsByFilter(
      "team_matches",
      [
        "game_setting = {:gameSettingId}",
        "round > {:currentRound}",
        "(status = 'in_progress' || status = 'completed')",
      ].join(" && "),
      "",
      1,
      0,
      {
        gameSettingId: teamMatch.getString("game_setting"),
        currentRound: teamMatch.getInt("round"),
      },
    );

    if (laterStartedMatches.length > 0) {
      throw new ApiError(
        409,
        "다음 라운드가 이미 시작되어 이전 라운드 결과를 취소할 수 없습니다.",
      );
    }

    const games = txDao.findRecordsByFilter(
      "match_games",
      "team_match = {:teamMatchId}",
      "sequence",
      100,
      0,
      {
        teamMatchId,
      },
    );

    const confirmedGames = games.filter(
      (game) => game.getString("result_status") === RESULT_STATUS_CONFIRMED,
    );

    if (confirmedGames.length === 0) {
      throw new ApiError(409, "취소할 확정 결과가 없습니다.");
    }

    const beforeData = {
      teamMatch: {
        status: teamMatch.getString("status"),
        version: teamMatch.getInt("version"),
      },

      games: games.map((game) => ({
        id: game.id,
        sequence: game.getInt("sequence"),
        status: game.getString("status"),
        resultStatus: game.getString("result_status"),
        homeScore: game.getInt("home_score"),
        awayScore: game.getInt("away_score"),
        winnerSide: game.getString("winner_side"),
        version: game.getInt("version"),
      })),
    };

    games.forEach((game) => {
      deleteGameSubmissions(txDao, game.id);
      resetResultFields(game);

      txDao.saveRecord(game);
    });

    teamMatch.set("status", "in_progress");
    teamMatch.set("completed_at", "");
    teamMatch.set("version", teamMatch.getInt("version") + 1);

    txDao.saveRecord(teamMatch);

    historyService.createHistory(txDao, {
      eventId: teamMatch.getString("event"),
      targetType: "team_match",
      targetId: teamMatch.id,
      action: "cancelled",
      requestId: normalized.requestId,
      actorType: "admin",
      actorId: normalized.adminId,
      actorName: normalized.adminName,
      reason: normalized.reason,

      beforeData,

      afterData: {
        teamMatch: {
          status: teamMatch.getString("status"),
          version: teamMatch.getInt("version"),
        },

        games: games.map((game) => ({
          id: game.id,
          sequence: game.getInt("sequence"),
          status: game.getString("status"),
          resultStatus: game.getString("result_status"),
          version: game.getInt("version"),
        })),
      },
    });
  });

  const rankingService = require(`${__hooks}/ranking_service.js`);

  rankingService.recalculateAllCandidates($app.dao());

  const record = $app.dao().findRecordById("team_matches", teamMatchId);

  return {
    id: record.id,
    status: record.getString("status"),
    version: record.getInt("version"),
  };
};

const cancelIndividualMatchResult = function (individualMatchId, input) {
  const normalized = normalizeInput(input);

  $app.dao().runInTransaction((txDao) => {
    const previousHistory = historyService.findHistoryByRequestId(
      txDao,
      normalized.requestId,
    );

    if (previousHistory) {
      if (
        previousHistory.getString("target_type") === "individual_match" &&
        previousHistory.getString("individual_match") === individualMatchId &&
        previousHistory.getString("actor_admin") === normalized.adminId
      ) {
        return;
      }

      throw new ApiError(409, "이미 다른 요청에서 사용된 요청 정보입니다.");
    }

    let match;

    try {
      match = txDao.findRecordById("individual_matches", individualMatchId);
    } catch {
      throw new ApiError(404, "개인 경기를 찾을 수 없습니다.");
    }

    if (match.getInt("version") !== normalized.expectedVersion) {
      throw new ApiError(
        409,
        "경기 정보가 변경되었습니다. 새로고침 후 다시 시도해 주세요.",
      );
    }

    if (match.getString("result_status") !== RESULT_STATUS_CONFIRMED) {
      throw new ApiError(409, "취소할 확정 결과가 없습니다.");
    }

    const beforeData = {
      status: match.getString("status"),
      resultStatus: match.getString("result_status"),
      homeScore: match.getInt("home_score"),
      awayScore: match.getInt("away_score"),
      winnerSide: match.getString("winner_side"),
      resultConfirmedAt: match.getString("result_confirmed_at"),
      version: match.getInt("version"),
    };

    deleteIndividualSubmissions(txDao, match.id);
    resetResultFields(match);

    /*
     * 이미 해당 테이블에 다음 경기가 배정됐을 수 있으므로
     * 결과를 취소한 경기는 테이블 배정 대기 상태로 되돌립니다.
     */
    match.set("status", "scheduled");
    match.set("table_number", 0);
    match.set("started_at", "");
    match.set("completed_at", "");

    txDao.saveRecord(match);

    /*
     * 마지막 경기까지 완료된 상태에서 결과를 취소하면
     * operation_status가 completed일 수 있습니다.
     *
     * scheduled 경기가 다시 생겼으므로 운영 상태도 진행 중으로 복구합니다.
     */
    const gameSettingRecord = txDao.findRecordById(
      "event_game_settings",
      match.getString("game_setting"),
    );

    gameSettingRecord.set("operation_status", "in_progress");

    txDao.saveRecord(gameSettingRecord);

    const operationService = require(`${__hooks}/match_operation_service.js`);

    operationService.assignIndividualMatches(txDao, gameSettingRecord.id);

    historyService.createHistory(txDao, {
      eventId: match.getString("event"),
      targetType: "individual_match",
      targetId: match.id,
      action: "cancelled",
      requestId: normalized.requestId,
      actorType: "admin",
      actorId: normalized.adminId,
      actorName: normalized.adminName,
      reason: normalized.reason,
      beforeData,

      afterData: {
        status: match.getString("status"),
        resultStatus: match.getString("result_status"),
        version: match.getInt("version"),
      },
    });
  });

  const rankingService = require(`${__hooks}/ranking_service.js`);

  rankingService.recalculateAllCandidates($app.dao());

  const record = $app
    .dao()
    .findRecordById("individual_matches", individualMatchId);

  return {
    id: record.id,
    status: record.getString("status"),
    version: record.getInt("version"),
  };
};

module.exports = Object.freeze({
  cancelTeamMatchResult,
  cancelIndividualMatchResult,
});
