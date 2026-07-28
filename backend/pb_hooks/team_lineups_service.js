/**
 * 참가자 개인 응답 토큰을 검증합니다.
 *
 * 참가자뿐 아니라 참가자가 속한 회차의 공개 접근 정책도 함께 검사합니다.
 * 이 함수를 사용하는 모든 공개 API는 동일한 만료 정책을 적용받습니다.
 */
const findParticipantByResponseToken = function (responseToken) {
  const config = require(`${__hooks}/config.js`);
  const dao = $app.dao();

  const normalizedToken = String(responseToken || "").trim();

  const invalidTokenMessage = "유효하지 않거나 만료된 본인 확인 정보입니다.";

  /*
   * 1. 토큰 형식 검사
   */
  if (
    !normalizedToken ||
    normalizedToken.length !== config.PARTICIPATION_TOKEN_LENGTH
  ) {
    throw new NotFoundError(invalidTokenMessage);
  }

  /*
   * 2. 토큰 hash로 참가자 조회
   */
  let participantRecord;

  try {
    participantRecord = dao.findFirstRecordByFilter(
      "event_participants",
      "participation_token_hash = {:tokenHash}",
      {
        tokenHash: $security.sha256(normalizedToken),
      },
    );
  } catch {
    throw new NotFoundError(invalidTokenMessage);
  }

  /*
   * 3. 참가자가 속한 회차 조회
   */
  const eventId = participantRecord.getString("event");

  let eventRecord;

  try {
    eventRecord = dao.findRecordById("events", eventId);
  } catch {
    throw new NotFoundError(invalidTokenMessage);
  }

  const publicAccess = require(`${__hooks}/public_event_access.js`);

  publicAccess.assertEventPublicAccess(eventRecord);

  /*
   * 7. 회원 참가자는 현재도 활동 중인지 검사
   *
   * 게스트는 members 레코드가 없으므로 이 검사를 하지 않습니다.
   */
  if (participantRecord.getString("participant_type") === "member") {
    let memberRecord;

    try {
      memberRecord = dao.findRecordById(
        "members",
        participantRecord.getString("member"),
      );
    } catch {
      throw new NotFoundError(invalidTokenMessage);
    }

    if (memberRecord.getString("status") !== "active") {
      throw new BadRequestError(
        "비활동 회원은 경기 정보에 접근할 수 없습니다.",
      );
    }
  }

  /*
   * 8. 현재 게임 참가 상태인지 검사
   */
  if (participantRecord.getString("game_participation_status") !== "playing") {
    throw new BadRequestError(
      "게임 참가 상태인 참가자만 경기 정보에 접근할 수 있습니다.",
    );
  }

  return participantRecord;
};

const findParticipantTeam = function (dao, participantRecord, teamMatchRecord) {
  const formationId = teamMatchRecord.getString("formation");
  const homeTeamId = teamMatchRecord.getString("home_team");
  const awayTeamId = teamMatchRecord.getString("away_team");

  const memberships = dao.findRecordsByFilter(
    "team_members",
    [
      "formation = {:formationId}",
      "participant = {:participantId}",
      "(team = {:homeTeamId} || team = {:awayTeamId})",
    ].join(" && "),
    "",
    2,
    0,
    {
      formationId,
      participantId: participantRecord.id,
      homeTeamId,
      awayTeamId,
    },
  );

  if (memberships.length !== 1) {
    throw new BadRequestError("이 경기에 참가하는 팀의 구성원이 아닙니다.");
  }

  return memberships[0];
};

const buildLineupContext = function (teamMatchId, responseToken) {
  const dao = $app.dao();

  const participantRecord = findParticipantByResponseToken(responseToken);

  let teamMatchRecord;

  try {
    teamMatchRecord = dao.findRecordById("team_matches", teamMatchId);
  } catch {
    throw new NotFoundError("팀 경기를 찾을 수 없습니다.");
  }

  const participantEventId = participantRecord.getString("event");

  if (participantEventId !== teamMatchRecord.getString("event")) {
    throw new BadRequestError("다른 회차의 경기에는 접근할 수 없습니다.");
  }

  let formationRecord;

  try {
    formationRecord = dao.findRecordById(
      "team_formations",
      teamMatchRecord.getString("formation"),
    );
  } catch {
    throw new NotFoundError("팀 편성 정보를 찾을 수 없습니다.");
  }

  if (formationRecord.getString("status") !== "confirmed") {
    throw new BadRequestError(
      "팀 편성이 변경되었습니다. 운영자가 팀 편성을 다시 확정해야 합니다.",
    );
  }

  const membershipRecord = findParticipantTeam(
    dao,
    participantRecord,
    teamMatchRecord,
  );

  const teamId = membershipRecord.getString("team");
  const homeTeamId = teamMatchRecord.getString("home_team");
  const awayTeamId = teamMatchRecord.getString("away_team");

  const opponentTeamId = teamId === homeTeamId ? awayTeamId : homeTeamId;

  const teamRecord = dao.findRecordById("teams", teamId);
  const opponentTeamRecord = dao.findRecordById("teams", opponentTeamId);

  const teamMemberRecords = dao.findRecordsByFilter(
    "team_members",
    ["formation = {:formationId}", "team = {:teamId}"].join(" && "),
    "sort_order",
    100,
    0,
    {
      formationId: formationRecord.id,
      teamId,
    },
  );

  const members = teamMemberRecords.map((teamMemberRecord) => {
    const teamParticipant = dao.findRecordById(
      "event_participants",
      teamMemberRecord.getString("participant"),
    );

    return {
      participantId: teamParticipant.id,
      displayName: teamParticipant.getString("display_name"),
      rankSnapshot: teamParticipant.getInt("rank_snapshot"),
      participantType: teamParticipant.getString("participant_type"),
      isRequester: teamParticipant.id === participantRecord.id,
    };
  });

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

  let lineupRecord;

  try {
    lineupRecord = dao.findFirstRecordByFilter(
      "team_match_lineups",
      ["team_match = {:teamMatchId}", "team = {:teamId}"].join(" && "),
      {
        teamMatchId: teamMatchRecord.id,
        teamId,
      },
    );
  } catch {
    throw new NotFoundError(
      "라인업 정보를 찾을 수 없습니다. 대진표를 다시 생성해 주세요.",
    );
  }

  const playerRecords = dao.findRecordsByFilter(
    "match_game_players",
    "lineup = {:lineupId}",
    "match_game,position",
    100,
    0,
    {
      lineupId: lineupRecord.id,
    },
  );

  let confirmedBy = null;

  const confirmedById = lineupRecord.getString("confirmed_by");

  if (confirmedById) {
    try {
      const confirmedParticipant = dao.findRecordById(
        "event_participants",
        confirmedById,
      );

      confirmedBy = {
        participantId: confirmedParticipant.id,
        displayName: confirmedParticipant.getString("display_name"),
      };
    } catch {
      confirmedBy = null;
    }
  }

  return {
    eventId: teamMatchRecord.getString("event"),

    match: {
      id: teamMatchRecord.id,
      round: teamMatchRecord.getInt("round"),
      sortOrder: teamMatchRecord.getInt("sort_order"),
      status: teamMatchRecord.getString("status"),
    },

    team: {
      id: teamRecord.id,
      name: teamRecord.getString("name"),
    },

    opponentTeam: {
      id: opponentTeamRecord.id,
      name: opponentTeamRecord.getString("name"),
    },

    requester: {
      participantId: participantRecord.id,
      displayName: participantRecord.getString("display_name"),
    },

    members,

    games: matchGameRecords.map((gameRecord) => ({
      id: gameRecord.id,
      sequence: gameRecord.getInt("sequence"),
      matchType: gameRecord.getString("match_type"),
      bestOf: gameRecord.getInt("best_of"),
      requiredPlayerCount:
        gameRecord.getString("match_type") === "doubles" ? 2 : 1,
      status: gameRecord.getString("status"),
    })),

    lineup: {
      id: lineupRecord.id,
      status: lineupRecord.getString("status"),
      version: lineupRecord.getInt("version"),
      confirmedAt: lineupRecord.getString("confirmed_at"),
      confirmedBy,

      players: playerRecords.map((playerRecord) => ({
        matchGameId: playerRecord.getString("match_game"),
        participantId: playerRecord.getString("participant"),
        position: playerRecord.getInt("position"),
      })),
    },
  };
};

const saveLineup = function (teamMatchId, responseToken, input) {
  const context = buildLineupContext(teamMatchId, responseToken);

  const status = String(input.status || "");
  const expectedVersion = Number(input.expectedVersion || 0);
  const submittedGames = input.games;

  if (status !== "draft" && status !== "confirmed") {
    throw new BadRequestError("라인업 저장 상태가 올바르지 않습니다.");
  }

  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw new BadRequestError("라인업 버전 정보가 올바르지 않습니다.");
  }

  if (!Array.isArray(submittedGames)) {
    throw new BadRequestError("라인업 선수 정보가 올바르지 않습니다.");
  }

  if (context.lineup.version !== expectedVersion) {
    throw new ApiError(
      409,
      "다른 팀원이 먼저 라인업을 수정했습니다. 최신 라인업을 다시 불러와 주세요.",
    );
  }

  const gamesById = new Map(context.games.map((game) => [game.id, game]));

  const teamMemberIds = new Set(
    context.members.map((member) => member.participantId),
  );

  const normalizedGames = submittedGames.map((submittedGame, gameIndex) => {
    if (!submittedGame || typeof submittedGame !== "object") {
      throw new BadRequestError(
        `${gameIndex + 1}번째 세부 경기 정보가 올바르지 않습니다.`,
      );
    }

    const matchGameId = String(submittedGame.matchGameId || "");

    const participantIds = submittedGame.participantIds;

    const game = gamesById.get(matchGameId);

    if (!game) {
      throw new BadRequestError(
        "현재 경기에 포함되지 않은 세부 경기가 있습니다.",
      );
    }

    if (!Array.isArray(participantIds)) {
      throw new BadRequestError(
        `${game.sequence}번째 경기의 출전 선수 정보가 올바르지 않습니다.`,
      );
    }

    const normalizedParticipantIds = participantIds.map((participantId) =>
      String(participantId || ""),
    );

    if (normalizedParticipantIds.some((participantId) => !participantId)) {
      throw new BadRequestError(
        `${game.sequence}번째 경기의 출전 선수 정보가 올바르지 않습니다.`,
      );
    }

    if (
      new Set(normalizedParticipantIds).size !== normalizedParticipantIds.length
    ) {
      throw new BadRequestError(
        `${game.sequence}번째 경기에 같은 선수를 중복 선택할 수 없습니다.`,
      );
    }

    if (
      normalizedParticipantIds.some(
        (participantId) => !teamMemberIds.has(participantId),
      )
    ) {
      throw new BadRequestError(
        `${game.sequence}번째 경기에 다른 팀 선수가 포함되어 있습니다.`,
      );
    }

    if (normalizedParticipantIds.length > game.requiredPlayerCount) {
      throw new BadRequestError(
        `${game.sequence}번째 ${game.matchType === "doubles" ? "복식" : "단식"} 경기는 ${game.requiredPlayerCount}명만 선택할 수 있습니다.`,
      );
    }

    if (
      status === "confirmed" &&
      normalizedParticipantIds.length !== game.requiredPlayerCount
    ) {
      throw new BadRequestError(
        `${game.sequence}번째 ${game.matchType === "doubles" ? "복식" : "단식"} 경기의 선수를 모두 선택해 주세요.`,
      );
    }

    return {
      matchGameId,
      sequence: game.sequence,
      participantIds: normalizedParticipantIds,
    };
  });

  const submittedGameIds = normalizedGames.map((game) => game.matchGameId);

  if (new Set(submittedGameIds).size !== submittedGameIds.length) {
    throw new BadRequestError("동일한 세부 경기 정보가 중복되어 있습니다.");
  }

  if (
    submittedGameIds.length !== context.games.length ||
    context.games.some((game) => !submittedGameIds.includes(game.id))
  ) {
    throw new BadRequestError("일부 세부 경기의 라인업 정보가 누락되었습니다.");
  }

  /*
   * 선택된 선수가 현재도 게임 참가 상태인지 저장 직전에 확인합니다.
   */
  const selectedParticipantIds = [
    ...new Set(normalizedGames.flatMap((game) => game.participantIds)),
  ];

  selectedParticipantIds.forEach((participantId) => {
    let participantRecord;

    try {
      participantRecord = $app
        .dao()
        .findRecordById("event_participants", participantId);
    } catch {
      throw new BadRequestError("선택한 참가자 정보를 찾을 수 없습니다.");
    }

    if (
      participantRecord.getString("game_participation_status") !== "playing"
    ) {
      throw new BadRequestError(
        `${participantRecord.getString("display_name")}님은 현재 게임 참가 상태가 아닙니다.`,
      );
    }

    if (participantRecord.getString("participant_type") === "member") {
      let memberRecord;

      try {
        memberRecord = $app
          .dao()
          .findRecordById("members", participantRecord.getString("member"));
      } catch {
        throw new BadRequestError("선택한 회원 정보를 찾을 수 없습니다.");
      }

      if (memberRecord.getString("status") !== "active") {
        throw new BadRequestError(
          `${participantRecord.getString("display_name")}님은 비활동 회원입니다.`,
        );
      }
    }
  });

  const nextVersion = expectedVersion + 1;

  $app.dao().runInTransaction((transactionDao) => {
    const lineupRecord = transactionDao.findRecordById(
      "team_match_lineups",
      context.lineup.id,
    );

    /*
     * 조회 이후 transaction 실행 전 다른 사용자가 저장한 경우도 검사합니다.
     */
    if (lineupRecord.getInt("version") !== expectedVersion) {
      throw new ApiError(
        409,
        "다른 팀원이 먼저 라인업을 수정했습니다. 최신 라인업을 다시 불러와 주세요.",
      );
    }

    /*
     * 라인업 조회 이후 경기가 시작됐을 수 있으므로
     * transaction 안에서 최신 경기 상태를 다시 확인합니다.
     */
    const teamMatchRecord = transactionDao.findRecordById(
      "team_matches",
      teamMatchId,
    );

    if (!["scheduled", "ready"].includes(teamMatchRecord.getString("status"))) {
      throw new ApiError(
        409,
        "경기가 이미 시작되었거나 종료되어 라인업을 변경할 수 없습니다.",
      );
    }

    const currentPlayers = transactionDao.findRecordsByFilter(
      "match_game_players",
      "lineup = {:lineupId}",
      "",
      100,
      0,
      {
        lineupId: lineupRecord.id,
      },
    );

    currentPlayers.forEach((playerRecord) => {
      transactionDao.deleteRecord(playerRecord);
    });

    const playersCollection =
      transactionDao.findCollectionByNameOrId("match_game_players");

    normalizedGames.forEach((game) => {
      game.participantIds.forEach((participantId, playerIndex) => {
        const playerRecord = new Record(playersCollection);

        playerRecord.set("lineup", lineupRecord.id);
        playerRecord.set("match_game", game.matchGameId);
        playerRecord.set("participant", participantId);
        playerRecord.set("position", playerIndex + 1);

        transactionDao.saveRecord(playerRecord);
      });
    });

    lineupRecord.set("status", status);
    lineupRecord.set("version", nextVersion);

    if (status === "confirmed") {
      lineupRecord.set("confirmed_by", context.requester.participantId);
      lineupRecord.set("confirmed_at", new Date().toISOString());
    } else {
      lineupRecord.set("confirmed_by", "");
      lineupRecord.set("confirmed_at", "");
    }

    transactionDao.saveRecord(lineupRecord);

    /*
     * 홈팀과 원정팀 라인업이 모두 확정되면
     * 팀 경기를 ready 상태로 변경합니다.
     */
    const matchLineups = transactionDao.findRecordsByFilter(
      "team_match_lineups",
      "team_match = {:teamMatchId}",
      "",
      2,
      0,
      {
        teamMatchId,
      },
    );

    const bothConfirmed =
      matchLineups.length === 2 &&
      matchLineups.every((currentLineup) => {
        if (currentLineup.id === context.lineup.id) {
          return status === "confirmed";
        }
        return currentLineup.getString("status") === "confirmed";
      });

    teamMatchRecord.set("status", bothConfirmed ? "ready" : "scheduled");

    /*
     * team_matches.version은 현재 대진표 전체 버전으로 사용하므로
     * 라인업 저장 시에는 증가시키지 않습니다.
     */
    transactionDao.saveRecord(teamMatchRecord);
  });

  return buildLineupContext(teamMatchId, responseToken);
};

const listParticipantMatches = function (responseToken) {
  const dao = $app.dao();

  const participantRecord = findParticipantByResponseToken(responseToken);

  const eventId = participantRecord.getString("event");

  const emptyResult = {
    eventId,
    team: null,
    matches: [],
  };

  let gameSettingRecord;

  try {
    gameSettingRecord = dao.findFirstRecordByFilter(
      "event_game_settings",
      ["event = {:eventId}", "competition_type = {:competitionType}"].join(
        " && ",
      ),
      {
        eventId,
        competitionType: "team_league",
      },
    );
  } catch {
    return emptyResult;
  }

  if (gameSettingRecord.getString("status") !== "confirmed") {
    return emptyResult;
  }

  let formationRecord;

  try {
    formationRecord = dao.findFirstRecordByFilter(
      "team_formations",
      "game_setting = {:gameSettingId}",
      {
        gameSettingId: gameSettingRecord.id,
      },
    );
  } catch {
    return emptyResult;
  }

  if (formationRecord.getString("status") !== "confirmed") {
    return emptyResult;
  }

  const membershipRecords = dao.findRecordsByFilter(
    "team_members",
    ["formation = {:formationId}", "participant = {:participantId}"].join(
      " && ",
    ),
    "",
    2,
    0,
    {
      formationId: formationRecord.id,
      participantId: participantRecord.id,
    },
  );

  if (membershipRecords.length !== 1) {
    return emptyResult;
  }

  const teamId = membershipRecords[0].getString("team");

  const teamRecord = dao.findRecordById("teams", teamId);

  const matchRecords = dao.findRecordsByFilter(
    "team_matches",
    [
      "formation = {:formationId}",
      "(home_team = {:teamId} || away_team = {:teamId})",
    ].join(" && "),
    "sort_order",
    500,
    0,
    {
      formationId: formationRecord.id,
      teamId,
    },
  );

  const matches = matchRecords.map((matchRecord) => {
    const homeTeamId = matchRecord.getString("home_team");
    const awayTeamId = matchRecord.getString("away_team");

    const opponentTeamId = homeTeamId === teamId ? awayTeamId : homeTeamId;

    const opponentTeamRecord = dao.findRecordById("teams", opponentTeamId);

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

    const ownLineup = lineupRecords.find(
      (lineupRecord) => lineupRecord.getString("team") === teamId,
    );

    const opponentLineup = lineupRecords.find(
      (lineupRecord) => lineupRecord.getString("team") === opponentTeamId,
    );

    return {
      id: matchRecord.id,
      round: matchRecord.getInt("round"),
      sortOrder: matchRecord.getInt("sort_order"),
      status: matchRecord.getString("status"),

      isHomeTeam: homeTeamId === teamId,

      opponentTeam: {
        id: opponentTeamRecord.id,
        name: opponentTeamRecord.getString("name"),
      },

      ownLineupStatus: ownLineup ? ownLineup.getString("status") : "draft",

      opponentLineupStatus: opponentLineup
        ? opponentLineup.getString("status")
        : "draft",
    };
  });

  return {
    eventId,

    team: {
      id: teamRecord.id,
      name: teamRecord.getString("name"),
    },

    matches,
  };
};
module.exports = Object.freeze({
  findParticipantByResponseToken,
  findParticipantTeam,
  buildLineupContext,
  saveLineup,
  listParticipantMatches,
});
