/// <reference path="../pb_data/types.d.ts" />

const teamLineupService = require(`${__hooks}/team_lineups_service.js`);
const { findParticipantByResponseToken } = teamLineupService;
const historyService = require(`${__hooks}/match_result_history_service.js`);

const TARGET_TYPE_TEAM_GAME = "team_game";
const TARGET_TYPE_INDIVIDUAL_MATCH = "individual_match";

const RESULT_STATUS_PENDING = "pending";
const RESULT_STATUS_DISPUTED = "disputed";
const RESULT_STATUS_CONFIRMED = "confirmed";

const SIDE_HOME = "home";
const SIDE_AWAY = "away";

const assertTargetType = (targetType) => {
  if (
    targetType !== TARGET_TYPE_TEAM_GAME &&
    targetType !== TARGET_TYPE_INDIVIDUAL_MATCH
  ) {
    throw new ApiError(400, "지원하지 않는 경기 종류입니다.");
  }
};

const getRequiredWins = (bestOf) => {
  const normalizedBestOf = Number(bestOf);

  if (
    !Number.isInteger(normalizedBestOf) ||
    normalizedBestOf < 1 ||
    normalizedBestOf % 2 === 0
  ) {
    throw new ApiError(400, "경기의 승리 조건이 올바르지 않습니다.");
  }

  return Math.floor(normalizedBestOf / 2) + 1;
};

const validateScore = (bestOf, homeScore, awayScore) => {
  const normalizedHomeScore = Number(homeScore);
  const normalizedAwayScore = Number(awayScore);

  if (
    !Number.isInteger(normalizedHomeScore) ||
    !Number.isInteger(normalizedAwayScore)
  ) {
    throw new ApiError(400, "점수는 정수로 입력해 주세요.");
  }

  if (normalizedHomeScore < 0 || normalizedAwayScore < 0) {
    throw new ApiError(400, "점수는 0 이상이어야 합니다.");
  }

  const requiredWins = getRequiredWins(bestOf);

  const homeWon =
    normalizedHomeScore === requiredWins && normalizedAwayScore < requiredWins;

  const awayWon =
    normalizedAwayScore === requiredWins && normalizedHomeScore < requiredWins;

  if (!homeWon && !awayWon) {
    throw new ApiError(
      400,
      `${bestOf}판 경기의 최종 점수가 올바르지 않습니다. 승자는 ${requiredWins}승이어야 합니다.`,
    );
  }

  return {
    homeScore: normalizedHomeScore,
    awayScore: normalizedAwayScore,
    winnerSide: homeWon ? SIDE_HOME : SIDE_AWAY,
  };
};

const getRecordDisplayName = (record) => {
  if (!record) {
    return "참가자";
  }

  return (
    record.getString("display_name") ||
    record.getString("nickname") ||
    record.getString("name") ||
    record.getString("guest_name") ||
    "참가자"
  );
};

const findSubmission = (dao, targetType, targetId, submittedSide) => {
  const targetField =
    targetType === TARGET_TYPE_TEAM_GAME ? "match_game" : "individual_match";

  try {
    return dao.findFirstRecordByFilter(
      "match_result_submissions",
      `${targetField} = {:targetId} && submitted_side = {:submittedSide}`,
      {
        targetId,
        submittedSide,
      },
    );
  } catch (_) {
    return null;
  }
};

const serializeSubmission = (record) => {
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    homeScore: record.getInt("home_score"),
    awayScore: record.getInt("away_score"),
    version: record.getInt("version"),
    updated: record.getString("updated"),
  };
};

const loadTeamPlayers = (dao, teamMatchId, matchGameId, teamId) => {
  let lineup;

  try {
    lineup = dao.findFirstRecordByFilter(
      "team_match_lineups",
      "team_match = {:teamMatchId} && team = {:teamId}",
      {
        teamMatchId,
        teamId,
      },
    );
  } catch (_) {
    return [];
  }

  const playerRecords = dao.findRecordsByFilter(
    "match_game_players",
    "lineup = {:lineupId} && match_game = {:matchGameId}",
    "position",
    10,
    0,
    {
      lineupId: lineup.id,
      matchGameId,
    },
  );

  return playerRecords.map((playerRecord) => {
    const participant = dao.findRecordById(
      "event_participants",
      playerRecord.getString("participant"),
    );

    return {
      participantId: participant.id,
      name: getRecordDisplayName(participant),
      position: playerRecord.getInt("position"),
    };
  });
};

const loadTeamMembers = (dao, formationId, teamId) => {
  const membershipRecords = dao.findRecordsByFilter(
    "team_members",
    "formation = {:formationId} && team = {:teamId}",
    "sort_order",
    100,
    0,
    {
      formationId,
      teamId,
    },
  );

  return membershipRecords.map((membershipRecord) => {
    const participant = dao.findRecordById(
      "event_participants",
      membershipRecord.getString("participant"),
    );

    return {
      participantId: participant.id,
      name: getRecordDisplayName(participant),
      position: membershipRecord.getInt("sort_order"),
    };
  });
};

const findTeamGameAccess = (dao, matchGameId, participantRecord) => {
  let matchGame;

  try {
    matchGame = dao.findRecordById("match_games", matchGameId);
  } catch (_) {
    throw new ApiError(404, "세부 경기를 찾을 수 없습니다.");
  }

  const teamMatch = dao.findRecordById(
    "team_matches",
    matchGame.getString("team_match"),
  );

  if (teamMatch.getString("event") !== participantRecord.getString("event")) {
    throw new ApiError(403, "해당 회차의 경기가 아닙니다.");
  }

  const membership = teamLineupService.findParticipantTeam(
    dao,
    participantRecord,
    teamMatch,
  );

  const participantTeamId = membership.getString("team");
  const homeTeamId = teamMatch.getString("home_team");
  const awayTeamId = teamMatch.getString("away_team");
  const formationId = teamMatch.getString("formation");

  let side;

  if (participantTeamId === homeTeamId) {
    side = SIDE_HOME;
  } else if (participantTeamId === awayTeamId) {
    side = SIDE_AWAY;
  } else {
    throw new ApiError(403, "참가자의 팀 정보를 확인할 수 없습니다.");
  }

  const homeTeam = dao.findRecordById("teams", homeTeamId);
  const awayTeam = dao.findRecordById("teams", awayTeamId);

  return {
    target: matchGame,
    side,
    bestOf: matchGame.getInt("best_of"),
    parentStatus: teamMatch.getString("status"),
    home: {
      id: homeTeamId,
      label: homeTeam.getString("name") || "홈 팀",
      players: loadTeamPlayers(dao, teamMatch.id, matchGame.id, homeTeamId),
      members: loadTeamMembers(dao, formationId, homeTeamId),
    },
    away: {
      id: awayTeamId,
      label: awayTeam.getString("name") || "원정 팀",
      players: loadTeamPlayers(dao, teamMatch.id, matchGame.id, awayTeamId),
      members: loadTeamMembers(dao, formationId, awayTeamId),
    },
  };
};

const saveTeamGamePlayers = (dao, access, participantIds) => {
  if (!Array.isArray(participantIds)) {
    throw new ApiError(400, "실제 출전 선수를 선택해 주세요.");
  }

  const requiredPlayerCount =
    access.target.getString("match_type") === "doubles" ? 2 : 1;

  const normalizedIds = participantIds.map((participantId) =>
    String(participantId || "").trim(),
  );

  if (
    normalizedIds.length !== requiredPlayerCount ||
    normalizedIds.some((participantId) => !participantId) ||
    new Set(normalizedIds).size !== normalizedIds.length
  ) {
    throw new ApiError(
      400,
      `${requiredPlayerCount}명의 실제 출전 선수를 선택해 주세요.`,
    );
  }

  const ownSide = access.side === SIDE_HOME ? access.home : access.away;
  const memberIds = new Set(
    ownSide.members.map((member) => member.participantId),
  );

  if (normalizedIds.some((participantId) => !memberIds.has(participantId))) {
    throw new ApiError(400, "자기 팀에 속한 선수만 선택할 수 있습니다.");
  }

  normalizedIds.forEach((participantId) => {
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
      teamMatchId: access.target.getString("team_match"),
      teamId: ownSide.id,
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
      matchGameId: access.target.id,
    },
  );

  previousPlayers.forEach((playerRecord) => dao.deleteRecord(playerRecord));

  const playersCollection =
    dao.findCollectionByNameOrId("match_game_players");

  normalizedIds.forEach((participantId, index) => {
    const playerRecord = new Record(playersCollection);

    playerRecord.set("lineup", lineup.id);
    playerRecord.set("match_game", access.target.id);
    playerRecord.set("participant", participantId);
    playerRecord.set("position", index + 1);

    dao.saveRecord(playerRecord);
  });
};

const findIndividualMatchAccess = (
  dao,
  individualMatchId,
  participantRecord,
) => {
  let individualMatch;

  try {
    individualMatch = dao.findRecordById(
      "individual_matches",
      individualMatchId,
    );
  } catch (_) {
    throw new ApiError(404, "개인 경기를 찾을 수 없습니다.");
  }

  if (
    individualMatch.getString("event") !== participantRecord.getString("event")
  ) {
    throw new ApiError(403, "해당 회차의 경기가 아닙니다.");
  }

  const homeParticipantId = individualMatch.getString("home_participant");
  const awayParticipantId = individualMatch.getString("away_participant");

  let side;

  if (participantRecord.id === homeParticipantId) {
    side = SIDE_HOME;
  } else if (participantRecord.id === awayParticipantId) {
    side = SIDE_AWAY;
  } else {
    throw new ApiError(
      403,
      "이 경기에 출전하는 참가자만 결과를 제출할 수 있습니다.",
    );
  }

  const homeParticipant = dao.findRecordById(
    "event_participants",
    homeParticipantId,
  );

  const awayParticipant = dao.findRecordById(
    "event_participants",
    awayParticipantId,
  );

  return {
    target: individualMatch,
    side,
    bestOf: individualMatch.getInt("best_of"),
    parentStatus: individualMatch.getString("status"),
    home: {
      id: homeParticipantId,
      label: getRecordDisplayName(homeParticipant),
      players: [
        {
          participantId: homeParticipantId,
          name: getRecordDisplayName(homeParticipant),
          position: 1,
        },
      ],
    },
    away: {
      id: awayParticipantId,
      label: getRecordDisplayName(awayParticipant),
      players: [
        {
          participantId: awayParticipantId,
          name: getRecordDisplayName(awayParticipant),
          position: 1,
        },
      ],
    },
  };
};

const findTargetAccess = (dao, targetType, targetId, participantRecord) => {
  assertTargetType(targetType);

  if (targetType === TARGET_TYPE_TEAM_GAME) {
    return findTeamGameAccess(dao, targetId, participantRecord);
  }

  return findIndividualMatchAccess(dao, targetId, participantRecord);
};

const assertCanSubmit = (targetType, access) => {
  const targetStatus = access.target.getString("status");
  const resultStatus = access.target.getString("result_status");

  if (resultStatus === RESULT_STATUS_CONFIRMED) {
    throw new ApiError(
      409,
      "이미 확정된 결과입니다. 수정이 필요하면 운영진에게 문의해 주세요.",
    );
  }

  if (targetStatus !== "in_progress") {
    throw new ApiError(409, "진행 중인 경기만 결과를 제출할 수 있습니다.");
  }

  if (
    targetType === TARGET_TYPE_TEAM_GAME &&
    access.parentStatus !== "in_progress"
  ) {
    throw new ApiError(409, "팀 대결이 진행 중인 상태가 아닙니다.");
  }
};

const buildResultContext = (targetType, targetId, responseToken) => {
  const participantRecord = findParticipantByResponseToken(responseToken);

  const dao = $app.dao();
  const access = findTargetAccess(dao, targetType, targetId, participantRecord);

  const otherSide = access.side === SIDE_HOME ? SIDE_AWAY : SIDE_HOME;

  const ownSubmission = findSubmission(dao, targetType, targetId, access.side);

  const otherSubmission = findSubmission(dao, targetType, targetId, otherSide);

  const resultStatus =
    access.target.getString("result_status") || RESULT_STATUS_PENDING;

  const confirmedResult =
    resultStatus === RESULT_STATUS_CONFIRMED
      ? {
          homeScore: access.target.getInt("home_score"),
          awayScore: access.target.getInt("away_score"),
          winnerSide: access.target.getString("winner_side"),
          confirmedAt: access.target.getString("result_confirmed_at"),
        }
      : null;

  return {
    targetType,
    targetId,
    status: access.target.getString("status"),
    resultStatus,
    bestOf: access.bestOf,
    requiredWins: getRequiredWins(access.bestOf),
    requiredPlayerCount:
      targetType === TARGET_TYPE_TEAM_GAME &&
      access.target.getString("match_type") === "doubles"
        ? 2
        : 1,
    side: access.side,
    home: access.home,
    away: access.away,
    ownSubmission: serializeSubmission(ownSubmission),

    // 상대편 점수는 확정 전에는 노출하지 않습니다.
    otherSideSubmitted: Boolean(otherSubmission),
    result: confirmedResult,
  };
};

const saveResultSubmission = (targetType, targetId, input) => {
  assertTargetType(targetType);

  const requestId = String(input.requestId || "").trim();
  const responseToken = String(input.responseToken || "").trim();
  const expectedVersion = Number(input.expectedVersion);

  if (!requestId || requestId.length > 100) {
    throw new ApiError(400, "요청 식별 정보가 올바르지 않습니다.");
  }

  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
    throw new ApiError(400, "결과 버전 정보가 올바르지 않습니다.");
  }

  const participantRecord = findParticipantByResponseToken(responseToken);

  $app.dao().runInTransaction((txDao) => {
    const previousHistory = historyService.findHistoryByRequestId(
      txDao,
      requestId,
    );

    if (previousHistory) {
      const sameParticipant =
        previousHistory.getString("actor_participant") === participantRecord.id;

      const sameType = previousHistory.getString("target_type") === targetType;

      const previousTargetId =
        targetType === TARGET_TYPE_TEAM_GAME
          ? previousHistory.getString("match_game")
          : previousHistory.getString("individual_match");

      if (!sameParticipant || !sameType || previousTargetId !== targetId) {
        throw new ApiError(
          409,
          "이미 다른 결과 요청에서 사용된 요청 정보입니다.",
        );
      }

      return;
    }

    const transactionParticipant = txDao.findRecordById(
      "event_participants",
      participantRecord.id,
    );

    const access = findTargetAccess(
      txDao,
      targetType,
      targetId,
      transactionParticipant,
    );

    assertCanSubmit(targetType, access);

    const validatedScore = validateScore(
      access.bestOf,
      input.homeScore,
      input.awayScore,
    );

    if (targetType === TARGET_TYPE_TEAM_GAME) {
      saveTeamGamePlayers(txDao, access, input.participantIds);
    }

    let ownSubmission = findSubmission(
      txDao,
      targetType,
      targetId,
      access.side,
    );

    const isNewSubmission = !ownSubmission;

    const beforeSubmission = ownSubmission
      ? {
          homeScore: ownSubmission.getInt("home_score"),
          awayScore: ownSubmission.getInt("away_score"),
          version: ownSubmission.getInt("version"),
        }
      : null;

    const beforeResult = {
      status: access.target.getString("status"),
      resultStatus:
        access.target.getString("result_status") || RESULT_STATUS_PENDING,
      homeScore: access.target.getInt("home_score"),
      awayScore: access.target.getInt("away_score"),
      winnerSide: access.target.getString("winner_side"),
      version: access.target.getInt("version"),
    };

    if (ownSubmission) {
      if (ownSubmission.getInt("version") !== expectedVersion) {
        throw new ApiError(
          409,
          "다른 요청에서 결과가 먼저 변경되었습니다. 새로고침 후 다시 시도해 주세요.",
        );
      }
    } else {
      if (expectedVersion !== 0) {
        throw new ApiError(
          409,
          "결과 정보가 변경되었습니다. 새로고침 후 다시 시도해 주세요.",
        );
      }

      const collection = txDao.findCollectionByNameOrId(
        "match_result_submissions",
      );

      ownSubmission = new Record(collection);
      ownSubmission.set("event", transactionParticipant.getString("event"));
      ownSubmission.set("target_type", targetType);

      if (targetType === TARGET_TYPE_TEAM_GAME) {
        ownSubmission.set("match_game", targetId);
        ownSubmission.set("individual_match", "");
      } else {
        ownSubmission.set("match_game", "");
        ownSubmission.set("individual_match", targetId);
      }
    }

    ownSubmission.set("submitted_side", access.side);
    ownSubmission.set("submitted_by", transactionParticipant.id);
    ownSubmission.set("home_score", validatedScore.homeScore);
    ownSubmission.set("away_score", validatedScore.awayScore);
    ownSubmission.set("version", expectedVersion + 1);

    txDao.saveRecord(ownSubmission);

    const otherSide = access.side === SIDE_HOME ? SIDE_AWAY : SIDE_HOME;

    const otherSubmission = findSubmission(
      txDao,
      targetType,
      targetId,
      otherSide,
    );

    const target = access.target;

    if (!otherSubmission) {
      target.set("result_status", RESULT_STATUS_PENDING);
      target.set("home_score", null);
      target.set("away_score", null);
      target.set("winner_side", "");
      target.set("result_confirmed_at", "");
    } else {
      const resultMatches =
        otherSubmission.getInt("home_score") === validatedScore.homeScore &&
        otherSubmission.getInt("away_score") === validatedScore.awayScore;

      if (resultMatches) {
        target.set("result_status", RESULT_STATUS_CONFIRMED);
        target.set("home_score", validatedScore.homeScore);
        target.set("away_score", validatedScore.awayScore);
        target.set("winner_side", validatedScore.winnerSide);
        target.set("result_confirmed_at", new Date().toISOString());
        target.set("status", "completed");

        if (targetType === TARGET_TYPE_INDIVIDUAL_MATCH) {
          target.set("completed_at", new Date().toISOString());
        }
      } else {
        target.set("result_status", RESULT_STATUS_DISPUTED);
        target.set("home_score", null);
        target.set("away_score", null);
        target.set("winner_side", "");
        target.set("result_confirmed_at", "");
        target.set("status", "in_progress");
      }
    }

    target.set("version", target.getInt("version") + 1);
    txDao.saveRecord(target);

    const nextResultStatus =
      target.getString("result_status") || RESULT_STATUS_PENDING;

    let historyAction = isNewSubmission ? "submitted" : "updated";

    if (nextResultStatus === RESULT_STATUS_CONFIRMED) {
      historyAction = "confirmed";
    } else if (nextResultStatus === RESULT_STATUS_DISPUTED) {
      historyAction = "disputed";
    }

    historyService.createHistory(txDao, {
      eventId: transactionParticipant.getString("event"),
      targetType,
      targetId,
      action: historyAction,
      requestId,
      actorType: "participant",
      actorId: transactionParticipant.id,
      actorName: getRecordDisplayName(transactionParticipant),
      submittedSide: access.side,

      beforeData: {
        submission: beforeSubmission,
        result: beforeResult,
      },

      afterData: {
        submission: {
          homeScore: ownSubmission.getInt("home_score"),
          awayScore: ownSubmission.getInt("away_score"),
          version: ownSubmission.getInt("version"),
        },

        result: {
          status: target.getString("status"),
          resultStatus: nextResultStatus,
          homeScore: target.getInt("home_score"),
          awayScore: target.getInt("away_score"),
          winnerSide: target.getString("winner_side"),
          version: target.getInt("version"),
        },
      },
    });

    if (target.getString("result_status") === RESULT_STATUS_CONFIRMED) {
      const completionService = require(
        `${__hooks}/match_result_completion_service.js`,
      );

      completionService.completeConfirmedResult(
        txDao,
        targetType,
        target,
      );
    }
  });

  /*
   * 결과 확정·불일치·재입력에 따라 공식 단식 연속 기록과
   * 승급·강등 후보를 최신 상태로 다시 계산합니다.
   */
  const rankingService = require(`${__hooks}/ranking_service.js`);

  rankingService.recalculateAllCandidates($app.dao());

  return buildResultContext(targetType, targetId, responseToken);
};

module.exports = {
  TARGET_TYPE_TEAM_GAME,
  TARGET_TYPE_INDIVIDUAL_MATCH,
  getRequiredWins,
  validateScore,
  buildResultContext,
  saveResultSubmission,
};
