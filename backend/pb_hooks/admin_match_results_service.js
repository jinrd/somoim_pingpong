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

const normalizeConfirmInput = function (input) {
  const requestId = String(input.requestId || "").trim();
  const expectedVersion = Number(input.expectedVersion);
  const reason = String(input.reason || "").trim();

  if (!requestId || requestId.length > 100) {
    throw new ApiError(400, "요청 식별 정보가 올바르지 않습니다.");
  }

  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw new ApiError(400, "결과 버전 정보가 올바르지 않습니다.");
  }

  if (reason.length > 500) {
    throw new ApiError(400, "입력 사유는 500자 이하로 입력해 주세요.");
  }

  return {
    requestId,
    expectedVersion,
    reason,
    homeScore: input.homeScore,
    awayScore: input.awayScore,
    homeParticipantIds: Array.isArray(input.homeParticipantIds)
      ? input.homeParticipantIds.map(String)
      : [],
    awayParticipantIds: Array.isArray(input.awayParticipantIds)
      ? input.awayParticipantIds.map(String)
      : [],
    adminId: String(input.adminId || ""),
    adminName: String(input.adminName || "관리자"),
  };
};

const saveTeamGamePlayers = function (
  dao,
  matchGame,
  teamMatch,
  teamId,
  participantIds,
) {
  const requiredCount = matchGame.getString("match_type") === "doubles" ? 2 : 1;
  const normalizedIds = participantIds.map((id) => String(id || "").trim());

  if (
    normalizedIds.length !== requiredCount ||
    normalizedIds.some((id) => !id) ||
    new Set(normalizedIds).size !== requiredCount
  ) {
    throw new ApiError(
      400,
      `${requiredCount}명의 실제 출전 선수를 선택해 주세요.`,
    );
  }

  const memberships = dao.findRecordsByFilter(
    "team_members",
    "formation = {:formationId} && team = {:teamId}",
    "",
    100,
    0,
    {
      formationId: teamMatch.getString("formation"),
      teamId,
    },
  );
  const memberIds = new Set(
    memberships.map((membership) => membership.getString("participant")),
  );

  normalizedIds.forEach((participantId) => {
    if (!memberIds.has(participantId)) {
      throw new ApiError(400, "해당 팀에 속한 선수만 선택할 수 있습니다.");
    }

    const participant = dao.findRecordById(
      "event_participants",
      participantId,
    );

    if (participant.getString("game_participation_status") !== "playing") {
      throw new ApiError(400, "게임 참가 상태인 선수만 선택할 수 있습니다.");
    }
  });

  const lineup = dao.findFirstRecordByFilter(
    "team_match_lineups",
    "team_match = {:teamMatchId} && team = {:teamId}",
    {
      teamMatchId: teamMatch.id,
      teamId,
    },
  );
  const previousPlayers = dao.findRecordsByFilter(
    "match_game_players",
    "lineup = {:lineupId} && match_game = {:matchGameId}",
    "",
    10,
    0,
    {
      lineupId: lineup.id,
      matchGameId: matchGame.id,
    },
  );

  previousPlayers.forEach((player) => dao.deleteRecord(player));

  const collection = dao.findCollectionByNameOrId("match_game_players");

  normalizedIds.forEach((participantId, index) => {
    const player = new Record(collection);
    player.set("lineup", lineup.id);
    player.set("match_game", matchGame.id);
    player.set("participant", participantId);
    player.set("position", index + 1);
    dao.saveRecord(player);
  });
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


const confirmMatchResult = function (targetType, targetId, input) {
  const normalized = normalizeConfirmInput(input);
  const resultService = require(`${__hooks}/match_results_service.js`);
  const isTeamGame =
    targetType === resultService.TARGET_TYPE_TEAM_GAME;

  if (
    !isTeamGame &&
    targetType !== resultService.TARGET_TYPE_INDIVIDUAL_MATCH
  ) {
    throw new ApiError(400, "지원하지 않는 경기 종류입니다.");
  }

  const collectionName = isTeamGame
    ? "match_games"
    : "individual_matches";

  $app.dao().runInTransaction((txDao) => {
    const previousHistory = historyService.findHistoryByRequestId(
      txDao,
      normalized.requestId,
    );

    if (previousHistory) {
      const previousTargetId = isTeamGame
        ? previousHistory.getString("match_game")
        : previousHistory.getString("individual_match");

      if (
        previousHistory.getString("target_type") === targetType &&
        previousTargetId === targetId &&
        previousHistory.getString("actor_admin") === normalized.adminId &&
        ["confirmed", "updated"].includes(
          previousHistory.getString("action"),
        )
      ) {
        return;
      }

      throw new ApiError(409, "이미 다른 요청에서 사용된 요청 정보입니다.");
    }

    let target;

    try {
      target = txDao.findRecordById(collectionName, targetId);
    } catch (_) {
      throw new ApiError(
        404,
        isTeamGame
          ? "팀 세부 경기를 찾을 수 없습니다."
          : "개인 경기를 찾을 수 없습니다.",
      );
    }

    if (target.getInt("version") !== normalized.expectedVersion) {
      throw new ApiError(
        409,
        "경기 정보가 변경되었습니다. 새로고침 후 다시 시도해 주세요.",
      );
    }

    const isEditingConfirmedResult =
      target.getString("status") === "completed" &&
      target.getString("result_status") === RESULT_STATUS_CONFIRMED;

    if (
      !isEditingConfirmedResult &&
      !["scheduled", "ready", "in_progress"].includes(
        target.getString("status"),
      )
    ) {
      throw new ApiError(
        409,
        "대기 중이거나 진행 중인 경기만 결과를 입력할 수 있습니다.",
      );
    }

    let eventId = target.getString("event");
    let teamMatch = null;

    if (isTeamGame) {
      teamMatch = txDao.findRecordById(
        "team_matches",
        target.getString("team_match"),
      );

      if (
        !isEditingConfirmedResult &&
        !["scheduled", "ready", "in_progress"].includes(
          teamMatch.getString("status"),
        )
      ) {
        throw new ApiError(
          409,
          "대기 중이거나 진행 중인 팀 대결만 결과를 입력할 수 있습니다.",
        );
      }

      eventId = teamMatch.getString("event");
    }

    const eventRecord = txDao.findRecordById("events", eventId);

    if (eventRecord.getString("status") === "archived") {
      throw new ApiError(409, "보관된 회차의 결과는 수정할 수 없습니다.");
    }

    if (
      eventRecord.getString("status") === "completed" &&
      !isEditingConfirmedResult
    ) {
      throw new ApiError(409, "종료된 회차에는 새 결과를 입력할 수 없습니다.");
    }

    const validatedScore = resultService.validateScore(
      target.getInt("best_of"),
      normalized.homeScore,
      normalized.awayScore,
    );

    if (isEditingConfirmedResult) {
      if (isTeamGame) {
        deleteGameSubmissions(txDao, target.id);
      } else {
        deleteIndividualSubmissions(txDao, target.id);
      }
    }

    if (isTeamGame) {
      saveTeamGamePlayers(
        txDao,
        target,
        teamMatch,
        teamMatch.getString("home_team"),
        normalized.homeParticipantIds,
      );
      saveTeamGamePlayers(
        txDao,
        target,
        teamMatch,
        teamMatch.getString("away_team"),
        normalized.awayParticipantIds,
      );
    }

    const beforeData = {
      status: target.getString("status"),
      resultStatus:
        target.getString("result_status") || RESULT_STATUS_PENDING,
      homeScore: target.getInt("home_score"),
      awayScore: target.getInt("away_score"),
      winnerSide: target.getString("winner_side"),
      resultConfirmedAt: target.getString("result_confirmed_at"),
      version: target.getInt("version"),
    };

    const confirmedAt = new Date().toISOString();

    target.set("status", "completed");
    target.set("result_status", RESULT_STATUS_CONFIRMED);
    target.set("home_score", validatedScore.homeScore);
    target.set("away_score", validatedScore.awayScore);
    target.set("winner_side", validatedScore.winnerSide);
    target.set("result_confirmed_at", confirmedAt);
    target.set("version", target.getInt("version") + 1);

    if (!isTeamGame) {
      target.set("completed_at", confirmedAt);
    }

    txDao.saveRecord(target);

    historyService.createHistory(txDao, {
      eventId,
      targetType,
      targetId,
      action: isEditingConfirmedResult ? "updated" : "confirmed",
      requestId: normalized.requestId,
      actorType: "admin",
      actorId: normalized.adminId,
      actorName: normalized.adminName,
      reason: normalized.reason,
      beforeData,

      afterData: {
        status: target.getString("status"),
        resultStatus: target.getString("result_status"),
        homeScore: target.getInt("home_score"),
        awayScore: target.getInt("away_score"),
        winnerSide: target.getString("winner_side"),
        resultConfirmedAt: target.getString("result_confirmed_at"),
        version: target.getInt("version"),
      },
    });

    const completionService = require(
      `${__hooks}/match_result_completion_service.js`,
    );

    if (!isEditingConfirmedResult) {
      completionService.completeConfirmedResult(
        txDao,
        targetType,
        target,
      );
    }
  });

  const rankingService = require(`${__hooks}/ranking_service.js`);

  rankingService.recalculateAllCandidates($app.dao());

  const record = $app.dao().findRecordById(collectionName, targetId);

  return {
    id: record.id,
    status: record.getString("status"),
    resultStatus: record.getString("result_status"),
    homeScore: record.getInt("home_score"),
    awayScore: record.getInt("away_score"),
    winnerSide: record.getString("winner_side"),
    resultConfirmedAt: record.getString("result_confirmed_at"),
    version: record.getInt("version"),
  };
};

const confirmTeamGameResult = function (matchGameId, input) {
  const resultService = require(`${__hooks}/match_results_service.js`);

  return confirmMatchResult(
    resultService.TARGET_TYPE_TEAM_GAME,
    matchGameId,
    input,
  );
};

const confirmIndividualMatchResult = function (individualMatchId, input) {
  const resultService = require(`${__hooks}/match_results_service.js`);

  return confirmMatchResult(
    resultService.TARGET_TYPE_INDIVIDUAL_MATCH,
    individualMatchId,
    input,
  );
};

module.exports = Object.freeze({
  confirmTeamGameResult,
  confirmIndividualMatchResult,
});
