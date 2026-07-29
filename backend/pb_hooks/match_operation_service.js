/// <reference path="../pb_data/types.d.ts" />

const OPERATION_NOT_STARTED = "not_started";
const OPERATION_IN_PROGRESS = "in_progress";
const OPERATION_COMPLETED = "completed";

const isFinishedStatus = (status) => {
  return status === "completed" || status === "cancelled";
};

const markEventActive = (dao, eventId) => {
  const eventRecord = dao.findRecordById("events", eventId);
  const currentStatus = eventRecord.getString("status");

  if (currentStatus === "archived") {
    throw new BadRequestError("보관된 회차의 경기를 시작할 수 없습니다.");
  }

  if (currentStatus === "completed") {
    throw new BadRequestError("종료된 회차의 경기를 다시 시작할 수 없습니다.");
  }

  if (currentStatus !== "draft") {
    return;
  }

  eventRecord.set("status", "active");
  eventRecord.set("version", eventRecord.getInt("version") + 1);

  dao.saveRecord(eventRecord);
};

const startTeamMatch = (dao, matchRecord) => {
  if (matchRecord.getString("status") !== "ready") {
    return false;
  }

  const lineupRecords = dao.findRecordsByFilter(
    "team_match_lineups",
    "team_match = {:teamMatchId}",
    "",
    2,
    0,
    {
      teamMatchId: matchRecord.id,
    },
  );

  const bothLineupsConfirmed =
    lineupRecords.length === 2 &&
    lineupRecords.every(
      (lineupRecord) => lineupRecord.getString("status") === "confirmed",
    );

  if (!bothLineupsConfirmed) {
    return false;
  }

  const gameRecords = dao.findRecordsByFilter(
    "match_games",
    "team_match = {:teamMatchId}",
    "sequence",
    100,
    0,
    {
      teamMatchId: matchRecord.id,
    },
  );

  if (gameRecords.length === 0) {
    throw new BadRequestError("팀 경기에 등록된 세부 경기가 없습니다.");
  }

  markEventActive(dao, matchRecord.getString("event"));

  const settingRecord = dao.findRecordById(
    "event_game_settings",
    matchRecord.getString("game_setting"),
  );

  if (
    settingRecord.getString("operation_status") !== OPERATION_IN_PROGRESS
  ) {
    settingRecord.set("operation_status", OPERATION_IN_PROGRESS);
    dao.saveRecord(settingRecord);
  }

  gameRecords.forEach((gameRecord) => {
    if (gameRecord.getString("status") !== "scheduled") {
      return;
    }

    gameRecord.set("status", "in_progress");
    gameRecord.set("result_status", "pending");
    gameRecord.set("version", gameRecord.getInt("version") + 1);

    dao.saveRecord(gameRecord);
  });

  matchRecord.set("status", "in_progress");
  matchRecord.set("started_at", new Date().toISOString());
  matchRecord.set("completed_at", "");
  matchRecord.set("version", matchRecord.getInt("version") + 1);

  dao.saveRecord(matchRecord);

  return true;
};

/*
 * 완료되지 않은 가장 앞 라운드만 활성 라운드로 판단합니다.
 *
 * 현재 라운드에서 양 팀 라인업이 확정된 경기는 자동 시작하지만,
 * 다음 라운드는 이전 라운드가 전부 끝날 때까지 시작하지 않습니다.
 */
const advanceTeamRound = (dao, gameSettingId) => {
  const settingRecord = dao.findRecordById(
    "event_game_settings",
    gameSettingId,
  );

  if (
    settingRecord.getString("competition_type") !== "team_league" ||
    settingRecord.getString("status") !== "confirmed"
  ) {
    return [];
  }

  const matchRecords = dao.findRecordsByFilter(
    "team_matches",
    "game_setting = {:gameSettingId}",
    "round,sort_order",
    500,
    0,
    {
      gameSettingId,
    },
  );

  const firstUnfinishedMatch = matchRecords.find(
    (matchRecord) => !isFinishedStatus(matchRecord.getString("status")),
  );

  if (!firstUnfinishedMatch) {
    return [];
  }

  const currentRound = firstUnfinishedMatch.getInt("round");

  const startedMatchIds = [];

  matchRecords
    .filter(
      (matchRecord) =>
        matchRecord.getInt("round") === currentRound &&
        matchRecord.getString("status") === "ready",
    )
    .forEach((matchRecord) => {
      if (startTeamMatch(dao, matchRecord)) {
        startedMatchIds.push(matchRecord.id);
      }
    });

  return startedMatchIds;
};

const startIndividualMatch = (dao, matchRecord, tableNumber) => {
  matchRecord.set("status", "in_progress");
  matchRecord.set("table_number", tableNumber);
  matchRecord.set("started_at", new Date().toISOString());
  matchRecord.set("completed_at", "");
  matchRecord.set("result_status", "pending");
  matchRecord.set("version", matchRecord.getInt("version") + 1);

  dao.saveRecord(matchRecord);

  return {
    matchId: matchRecord.id,
    tableNumber,
  };
};

/*
 * 빈 테이블에 경기 순서가 가장 빠른 경기를 배정합니다.
 *
 * 이미 다른 경기에서 출전 중인 참가자가 포함된 경기는 건너뛰고,
 * 다음 경기부터 검사합니다. 건너뛴 경기는 scheduled 상태로 남아
 * 다음 경기 종료 시 다시 검사됩니다.
 */
const assignIndividualMatches = (dao, gameSettingId) => {
  const settingRecord = dao.findRecordById(
    "event_game_settings",
    gameSettingId,
  );

  if (
    settingRecord.getString("competition_type") !== "individual_singles" ||
    settingRecord.getString("status") !== "confirmed" ||
    settingRecord.getString("operation_status") !== OPERATION_IN_PROGRESS
  ) {
    return [];
  }

  const tableCount = settingRecord.getInt("individual_table_count");

  if (!Number.isInteger(tableCount) || tableCount < 1) {
    throw new BadRequestError("사용할 단식 테이블 수를 확인해 주세요.");
  }

  const inProgressMatches = dao.findRecordsByFilter(
    "individual_matches",
    ["game_setting = {:gameSettingId}", "status = 'in_progress'"].join(" && "),
    "sort_order",
    500,
    0,
    {
      gameSettingId,
    },
  );

  const occupiedTables = new Set();
  const busyParticipantIds = new Set();

  inProgressMatches.forEach((matchRecord) => {
    const tableNumber = matchRecord.getInt("table_number");

    if (tableNumber >= 1 && tableNumber <= tableCount) {
      occupiedTables.add(tableNumber);
    }

    busyParticipantIds.add(matchRecord.getString("home_participant"));
    busyParticipantIds.add(matchRecord.getString("away_participant"));
  });

  /*
   * 이전 데이터에 진행 중이지만 테이블 번호가 없는 경기가 있다면
   * 빈 테이블을 먼저 배정합니다.
   */
  inProgressMatches.forEach((matchRecord) => {
    const currentTableNumber = matchRecord.getInt("table_number");

    if (currentTableNumber >= 1 && currentTableNumber <= tableCount) {
      return;
    }

    let availableTableNumber = 0;

    for (let tableNumber = 1; tableNumber <= tableCount; tableNumber += 1) {
      if (!occupiedTables.has(tableNumber)) {
        availableTableNumber = tableNumber;
        break;
      }
    }

    if (availableTableNumber === 0) {
      return;
    }

    matchRecord.set("table_number", availableTableNumber);
    matchRecord.set("version", matchRecord.getInt("version") + 1);

    dao.saveRecord(matchRecord);
    occupiedTables.add(availableTableNumber);
  });

  const scheduledMatches = dao.findRecordsByFilter(
    "individual_matches",
    ["game_setting = {:gameSettingId}", "status = 'scheduled'"].join(" && "),
    "sort_order",
    500,
    0,
    {
      gameSettingId,
    },
  );

  const assignedMatches = [];
  const assignedMatchIds = new Set();

  for (let tableNumber = 1; tableNumber <= tableCount; tableNumber += 1) {
    if (occupiedTables.has(tableNumber)) {
      continue;
    }

    const candidate = scheduledMatches.find((matchRecord) => {
      if (assignedMatchIds.has(matchRecord.id)) {
        return false;
      }

      const homeParticipantId = matchRecord.getString("home_participant");
      const awayParticipantId = matchRecord.getString("away_participant");

      return (
        !busyParticipantIds.has(homeParticipantId) &&
        !busyParticipantIds.has(awayParticipantId)
      );
    });

    if (!candidate) {
      continue;
    }

    assignedMatches.push(startIndividualMatch(dao, candidate, tableNumber));

    assignedMatchIds.add(candidate.id);
    busyParticipantIds.add(candidate.getString("home_participant"));
    busyParticipantIds.add(candidate.getString("away_participant"));
    occupiedTables.add(tableNumber);
  }

  const remainingMatches = dao.findRecordsByFilter(
    "individual_matches",
    [
      "game_setting = {:gameSettingId}",
      "(status = 'scheduled' || status = 'in_progress')",
    ].join(" && "),
    "",
    1,
    0,
    {
      gameSettingId,
    },
  );

  if (remainingMatches.length === 0) {
    settingRecord.set("operation_status", OPERATION_COMPLETED);
    dao.saveRecord(settingRecord);
  }

  return assignedMatches;
};

const startIndividualLeague = (gameSettingId) => {
  let tableCount = 0;

  /*
   * 시작 상태를 먼저 확정한 다음 경기를 배정합니다.
   * 같은 트랜잭션에서 operation_status 변경 직후 설정을 다시 조회하면
   * 변경 전 상태가 보일 수 있어 배정이 누락될 수 있습니다.
   */
  $app.dao().runInTransaction((transactionDao) => {
    const settingRecord = transactionDao.findRecordById(
      "event_game_settings",
      gameSettingId,
    );

    if (settingRecord.getString("competition_type") !== "individual_singles") {
      throw new BadRequestError(
        "개인 단식 풀리그 설정에서만 시작할 수 있습니다.",
      );
    }

    if (settingRecord.getString("status") !== "confirmed") {
      throw new BadRequestError("게임 설정을 먼저 최종 확정해 주세요.");
    }

    tableCount = settingRecord.getInt("individual_table_count");

    if (!Number.isInteger(tableCount) || tableCount < 1) {
      throw new BadRequestError("사용할 단식 테이블 수를 확인해 주세요.");
    }

    const matchRecords = transactionDao.findRecordsByFilter(
      "individual_matches",
      "game_setting = {:gameSettingId}",
      "sort_order",
      500,
      0,
      {
        gameSettingId,
      },
    );

    if (matchRecords.length === 0) {
      throw new BadRequestError("단식 대진표를 먼저 저장해 주세요.");
    }

    const currentOperationStatus =
      settingRecord.getString("operation_status") || OPERATION_NOT_STARTED;

    if (currentOperationStatus === OPERATION_COMPLETED) {
      throw new BadRequestError("이미 모든 단식 경기가 완료되었습니다.");
    }

    markEventActive(transactionDao, settingRecord.getString("event"));

    if (currentOperationStatus === OPERATION_NOT_STARTED) {
      settingRecord.set("operation_status", OPERATION_IN_PROGRESS);
      transactionDao.saveRecord(settingRecord);
    }

  });

  const assignedMatches = assignIndividualMatches($app.dao(), gameSettingId);

  return {
    operationStatus: OPERATION_IN_PROGRESS,
    tableCount,
    assignedMatches,
  };
};

module.exports = Object.freeze({
  OPERATION_NOT_STARTED,
  OPERATION_IN_PROGRESS,
  OPERATION_COMPLETED,
  advanceTeamRound,
  assignIndividualMatches,
  startIndividualLeague,
});
