/// <reference path="../pb_data/types.d.ts" />

const TEAM_MATCH_TRANSITIONS = Object.freeze({
  scheduled: ["ready"],
  ready: ["in_progress"],
  in_progress: ["cancelled"],
  completed: [],
  cancelled: [],
});

const INDIVIDUAL_MATCH_TRANSITIONS = Object.freeze({
  scheduled: ["in_progress"],
  in_progress: ["cancelled"],
  completed: [],
  cancelled: [],
});

const normalizeInput = function (input) {
  const expectedVersion = Number(input.expectedVersion);
  const nextStatus = String(input.nextStatus || "").trim();

  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw new BadRequestError("경기 버전 정보가 올바르지 않습니다.");
  }

  if (!nextStatus) {
    throw new BadRequestError("변경할 경기 상태를 입력해 주세요.");
  }

  return {
    expectedVersion,
    nextStatus,
  };
};

const assertAllowedTransition = function (
  currentStatus,
  nextStatus,
  transitionRules,
) {
  const allowedNextStatuses = transitionRules[currentStatus] || [];

  if (!allowedNextStatuses.includes(nextStatus)) {
    throw new BadRequestError(
      `${currentStatus} 상태에서 ${nextStatus} 상태로 변경할 수 없습니다.`,
    );
  }
};

const assertEventEditable = function (dao, matchRecord) {
  let eventRecord;

  try {
    eventRecord = dao.findRecordById("events", matchRecord.getString("event"));
  } catch {
    throw new NotFoundError("경기에 연결된 회차를 찾을 수 없습니다.");
  }

  if (eventRecord.getString("status") === "archived") {
    throw new BadRequestError("보관된 회차의 경기 상태는 변경할 수 없습니다.");
  }
};

const assertParticipantEligible = function (dao, participantId) {
  let participantRecord;

  try {
    participantRecord = dao.findRecordById("event_participants", participantId);
  } catch {
    throw new BadRequestError(
      "경기에 존재하지 않는 참가자가 포함되어 있습니다.",
    );
  }

  const displayName = participantRecord.getString("display_name") || "참가자";

  if (participantRecord.getString("game_participation_status") !== "playing") {
    throw new BadRequestError(
      `${displayName}님은 현재 게임 참가 상태가 아닙니다.`,
    );
  }

  if (participantRecord.getString("participant_type") !== "member") {
    return;
  }

  let memberRecord;

  try {
    memberRecord = dao.findRecordById(
      "members",
      participantRecord.getString("member"),
    );
  } catch {
    throw new BadRequestError("경기에 연결된 회원 정보를 찾을 수 없습니다.");
  }

  if (memberRecord.getString("status") !== "active") {
    throw new BadRequestError(`${displayName}님은 비활동 회원입니다.`);
  }
};

const assertTeamLineupsConfirmed = function (dao, teamMatchRecord) {
  const teamMatchId = teamMatchRecord.id;

  const lineupRecords = dao.findRecordsByFilter(
    "team_match_lineups",
    "team_match = {:teamMatchId}",
    "",
    3,
    0,
    {
      teamMatchId,
    },
  );

  if (
    lineupRecords.length !== 2 ||
    !lineupRecords.every(
      (lineupRecord) => lineupRecord.getString("status") === "confirmed",
    )
  ) {
    throw new BadRequestError(
      "양 팀의 라인업이 모두 확정되어야 경기를 시작할 수 있습니다.",
    );
  }

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

  if (matchGameRecords.length === 0) {
    throw new BadRequestError("팀 경기에 등록된 세부 경기가 없습니다.");
  }

  lineupRecords.forEach((lineupRecord) => {
    matchGameRecords.forEach((matchGameRecord) => {
      const playerRecords = dao.findRecordsByFilter(
        "match_game_players",
        ["lineup = {:lineupId}", "match_game = {:matchGameId}"].join(" && "),
        "position",
        3,
        0,
        {
          lineupId: lineupRecord.id,
          matchGameId: matchGameRecord.id,
        },
      );

      const expectedPlayerCount =
        matchGameRecord.getString("match_type") === "doubles" ? 2 : 1;

      if (playerRecords.length !== expectedPlayerCount) {
        throw new BadRequestError(
          `${matchGameRecord.getInt("sequence")}번째 세부 경기의 출전 선수가 올바르게 확정되지 않았습니다.`,
        );
      }

      playerRecords.forEach((playerRecord) => {
        assertParticipantEligible(dao, playerRecord.getString("participant"));
      });
    });
  });
};

const startTeamMatchGames = function (dao, teamMatchRecord) {
  const matchGameRecords = dao.findRecordsByFilter(
    "match_games",
    "team_match = {:teamMatchId}",
    "sequence",
    100,
    0,
    {
      teamMatchId: teamMatchRecord.id,
    },
  );

  matchGameRecords.forEach((matchGameRecord) => {
    if (matchGameRecord.getString("status") !== "scheduled") {
      return;
    }

    matchGameRecord.set("status", "in_progress");

    if (!matchGameRecord.getString("result_status")) {
      matchGameRecord.set("result_status", "pending");
    }

    matchGameRecord.set("version", matchGameRecord.getInt("version") + 1);

    dao.saveRecord(matchGameRecord);
  });
};

const changeTeamMatchStatus = function (matchId, input) {
  const normalizedInput = normalizeInput(input);
  let responseData;

  $app.dao().runInTransaction((transactionDao) => {
    let matchRecord;

    try {
      matchRecord = transactionDao.findRecordById("team_matches", matchId);
    } catch {
      throw new NotFoundError("팀 경기를 찾을 수 없습니다.");
    }

    const currentVersion = matchRecord.getInt("version");

    const currentStatus = matchRecord.getString("status");

    if (currentVersion !== normalizedInput.expectedVersion) {
      throw new ApiError(
        409,
        "다른 사용자가 경기 상태를 먼저 변경했습니다. 최신 정보를 다시 불러와 주세요.",
      );
    }

    assertEventEditable(transactionDao, matchRecord);

    assertAllowedTransition(
      currentStatus,
      normalizedInput.nextStatus,
      TEAM_MATCH_TRANSITIONS,
    );

    if (normalizedInput.nextStatus === "in_progress") {
      assertTeamLineupsConfirmed(transactionDao, matchRecord);

      startTeamMatchGames(transactionDao, matchRecord);
    }

    const nextVersion = currentVersion + 1;

    matchRecord.set("status", normalizedInput.nextStatus);

    if (normalizedInput.nextStatus === "in_progress") {
      matchRecord.set("started_at", new Date().toISOString());

      matchRecord.set("completed_at", "");
    }

    matchRecord.set("version", nextVersion);

    transactionDao.saveRecord(matchRecord);

    responseData = {
      match: {
        id: matchRecord.id,
        status: matchRecord.getString("status"),
        version: nextVersion,
        startedAt: matchRecord.getString("started_at"),
        completedAt: matchRecord.getString("completed_at"),
      },
    };
  });

  return responseData;
};

const changeIndividualMatchStatus = function (matchId, input) {
  const normalizedInput = normalizeInput(input);
  let responseData;

  $app.dao().runInTransaction((transactionDao) => {
    let matchRecord;

    try {
      matchRecord = transactionDao.findRecordById(
        "individual_matches",
        matchId,
      );
    } catch {
      throw new NotFoundError("개인 단식 경기를 찾을 수 없습니다.");
    }

    const currentVersion = matchRecord.getInt("version");

    const currentStatus = matchRecord.getString("status");

    if (currentVersion !== normalizedInput.expectedVersion) {
      throw new ApiError(
        409,
        "다른 사용자가 경기 상태를 먼저 변경했습니다. 최신 정보를 다시 불러와 주세요.",
      );
    }

    assertEventEditable(transactionDao, matchRecord);

    assertAllowedTransition(
      currentStatus,
      normalizedInput.nextStatus,
      INDIVIDUAL_MATCH_TRANSITIONS,
    );

    if (normalizedInput.nextStatus === "in_progress") {
      assertParticipantEligible(
        transactionDao,
        matchRecord.getString("home_participant"),
      );

      assertParticipantEligible(
        transactionDao,
        matchRecord.getString("away_participant"),
      );
    }

    const nextVersion = currentVersion + 1;

    matchRecord.set("status", normalizedInput.nextStatus);

    if (normalizedInput.nextStatus === "in_progress") {
      matchRecord.set("started_at", new Date().toISOString());

      matchRecord.set("completed_at", "");
    }

    matchRecord.set("version", nextVersion);

    transactionDao.saveRecord(matchRecord);

    responseData = {
      match: {
        id: matchRecord.id,
        status: matchRecord.getString("status"),
        version: nextVersion,
        startedAt: matchRecord.getString("started_at"),
        completedAt: matchRecord.getString("completed_at"),
      },
    };
  });

  return responseData;
};

module.exports = Object.freeze({
  changeTeamMatchStatus,
  changeIndividualMatchStatus,
});
