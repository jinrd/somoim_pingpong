/// <reference path="../pb_data/types.d.ts" />

const RESULT_CONFIRMED = "confirmed";
const RESULT_DISPUTED = "disputed";
const WIN_POINTS = 2;
const LOSS_POINTS = 1;

const safeFindFirst = function (dao, collection, filter, params) {
  try {
    return dao.findFirstRecordByFilter(collection, filter, params);
  } catch {
    return null;
  }
};

const getSubmissionCount = function (dao, targetType, targetId) {
  const field = targetType === "team_game" ? "match_game" : "individual_match";

  return dao.findRecordsByFilter(
    "match_result_submissions",
    `${field} = {:targetId}`,
    "",
    2,
    0,
    {
      targetId,
    },
  ).length;
};

const getPublicParticipant = function (responseToken) {
  const config = require(`${__hooks}/config.js`);

  const normalizedToken = String(responseToken || "").trim();

  if (
    !normalizedToken ||
    normalizedToken.length !== config.PARTICIPATION_TOKEN_LENGTH
  ) {
    throw new NotFoundError("유효하지 않거나 만료된 본인 확인 정보입니다.");
  }

  const dao = $app.dao();

  const participant = safeFindFirst(
    dao,
    "event_participants",
    "participation_token_hash = {:tokenHash}",
    {
      tokenHash: $security.sha256(normalizedToken),
    },
  );

  if (!participant) {
    throw new NotFoundError("유효하지 않거나 만료된 본인 확인 정보입니다.");
  }

  const eventRecord = dao.findRecordById(
    "events",
    participant.getString("event"),
  );

  require(`${__hooks}/public_event_access.js`).assertEventPublicAccess(
    eventRecord,
  );

  if (participant.getString("participant_type") === "member") {
    const member = dao.findRecordById(
      "members",
      participant.getString("member"),
    );

    if (member.getString("status") !== "active") {
      throw new BadRequestError(
        "비활동 회원은 경기 현황을 조회할 수 없습니다.",
      );
    }
  }

  return participant;
};

const getConfirmedSetting = function (dao, eventId) {
  const setting = safeFindFirst(
    dao,
    "event_game_settings",
    "event = {:eventId} && status = 'confirmed'",
    {
      eventId,
    },
  );

  if (!setting) {
    throw new NotFoundError("확정된 게임 설정을 찾을 수 없습니다.");
  }

  return setting;
};

const compareSetRatio = function (left, right) {
  if (left.scoreAgainst === 0 || right.scoreAgainst === 0) {
    if (left.scoreAgainst === 0 && right.scoreAgainst === 0) {
      return right.scoreFor - left.scoreFor;
    }

    return left.scoreAgainst === 0 ? -1 : 1;
  }

  return (
    right.scoreFor * left.scoreAgainst -
    left.scoreFor * right.scoreAgainst
  );
};

const getSetRatio = function (scoreFor, scoreAgainst) {
  if (scoreAgainst === 0) {
    return null;
  }

  return scoreFor / scoreAgainst;
};

const sortAndRankRows = function (rows, completedResults) {
  const pointGroups = new Map();

  rows.forEach((row) => {
    const group = pointGroups.get(row.points) || [];
    group.push(row);
    pointGroups.set(row.points, group);
  });

  pointGroups.forEach((group) => {
    const groupIds = new Set(group.map((row) => row.entityId));
    const headToHeadPoints = new Map(
      group.map((row) => [row.entityId, 0]),
    );

    completedResults.forEach((result) => {
      if (
        !groupIds.has(result.homeEntityId) ||
        !groupIds.has(result.awayEntityId) ||
        !result.winnerEntityId
      ) {
        return;
      }

      const loserEntityId =
        result.winnerEntityId === result.homeEntityId
          ? result.awayEntityId
          : result.homeEntityId;

      headToHeadPoints.set(
        result.winnerEntityId,
        (headToHeadPoints.get(result.winnerEntityId) || 0) + WIN_POINTS,
      );
      headToHeadPoints.set(
        loserEntityId,
        (headToHeadPoints.get(loserEntityId) || 0) + LOSS_POINTS,
      );
    });

    group.forEach((row) => {
      row.headToHeadPoints = headToHeadPoints.get(row.entityId) || 0;
    });
  });

  rows.sort((left, right) => {
    if (right.points !== left.points) {
      return right.points - left.points;
    }

    if (right.headToHeadPoints !== left.headToHeadPoints) {
      return right.headToHeadPoints - left.headToHeadPoints;
    }

    const setRatioResult = compareSetRatio(left, right);

    if (setRatioResult !== 0) {
      return setRatioResult;
    }

    return left.name.localeCompare(right.name);
  });

  let previousRank = 0;

  return rows.map((row, index) => {
    const previous = index > 0 ? rows[index - 1] : null;
    const isSameRank =
      previous &&
      previous.points === row.points &&
      previous.headToHeadPoints === row.headToHeadPoints &&
      compareSetRatio(previous, row) === 0;

    const rank = isSameRank ? previousRank : index + 1;
    previousRank = rank;

    return {
      ...row,
      rank,
    };
  });
};

const getTeamGamePlayers = function (dao, matchGameId, lineupId) {
  if (!lineupId) {
    return [];
  }

  const players = dao.findRecordsByFilter(
    "match_game_players",
    ["match_game = {:matchGameId}", "lineup = {:lineupId}"].join(" && "),
    "position",
    4,
    0,
    {
      matchGameId,
      lineupId,
    },
  );

  return players.map((player) => {
    const participant = dao.findRecordById(
      "event_participants",
      player.getString("participant"),
    );

    return {
      participantId: participant.id,
      name: participant.getString("display_name") || "참가자",
      position: player.getInt("position"),
    };
  });
};

const buildTeamStandings = function (dao, setting) {
  const formation = safeFindFirst(
    dao,
    "team_formations",
    "game_setting = {:gameSettingId} && status = 'confirmed'",
    {
      gameSettingId: setting.id,
    },
  );

  if (!formation) {
    return {
      competitionType: "team_league",
      entities: [],
      matches: [],
      standings: [],
    };
  }

  const teamRecords = dao.findRecordsByFilter(
    "teams",
    "formation = {:formationId}",
    "sort_order",
    100,
    0,
    {
      formationId: formation.id,
    },
  );

  const entities = teamRecords.map((team) => ({
    id: team.id,
    name: team.getString("name"),
    sortOrder: team.getInt("sort_order"),
  }));

  const teamsById = new Map(entities.map((team) => [team.id, team]));

  const stats = new Map(
    entities.map((team) => [
      team.id,
      {
        entityId: team.id,
        name: team.name,

        played: 0,
        wins: 0,
        losses: 0,
        points: 0,
        headToHeadPoints: 0,

        scoreFor: 0,
        scoreAgainst: 0,
        setRatio: null,

        rank: 0,
      },
    ]),
  );

  const matchRecords = dao.findRecordsByFilter(
    "team_matches",
    "game_setting = {:gameSettingId}",
    "sort_order",
    500,
    0,
    {
      gameSettingId: setting.id,
    },
  );

  const completedResults = [];

  const matches = matchRecords.map((match) => {
    const homeTeamId = match.getString("home_team");

    const awayTeamId = match.getString("away_team");

    const lineups = dao.findRecordsByFilter(
      "team_match_lineups",
      "team_match = {:teamMatchId}",
      "",
      2,
      0,
      {
        teamMatchId: match.id,
      },
    );

    const homeLineup = lineups.find(
      (lineup) => lineup.getString("team") === homeTeamId,
    );

    const awayLineup = lineups.find(
      (lineup) => lineup.getString("team") === awayTeamId,
    );

    const gameRecords = dao.findRecordsByFilter(
      "match_games",
      "team_match = {:teamMatchId}",
      "sequence",
      100,
      0,
      {
        teamMatchId: match.id,
      },
    );

    let homeGameWins = 0;
    let awayGameWins = 0;
    let homeSetWins = 0;
    let awaySetWins = 0;

    const games = gameRecords.map((game) => {
      const resultStatus = game.getString("result_status") || "pending";

      if (resultStatus === RESULT_CONFIRMED) {
        homeSetWins += game.getInt("home_score");
        awaySetWins += game.getInt("away_score");

        if (game.getString("winner_side") === "home") {
          homeGameWins += 1;
        } else if (game.getString("winner_side") === "away") {
          awayGameWins += 1;
        }
      }

      return {
        id: game.id,
        sequence: game.getInt("sequence"),

        matchType: game.getString("match_type"),

        bestOf: game.getInt("best_of"),

        status: game.getString("status"),
        resultStatus,

        homeScore: game.getInt("home_score"),
        awayScore: game.getInt("away_score"),

        winnerSide: game.getString("winner_side"),

        submissionCount: getSubmissionCount(dao, "team_game", game.id),

        homePlayers: getTeamGamePlayers(dao, game.id, homeLineup?.id || ""),

        awayPlayers: getTeamGamePlayers(dao, game.id, awayLineup?.id || ""),
      };
    });

    const allConfirmed =
      games.length > 0 &&
      games.every((game) => game.resultStatus === RESULT_CONFIRMED);

    const hasDisputed = games.some(
      (game) => game.resultStatus === RESULT_DISPUTED,
    );

    const resultStatus = hasDisputed
      ? "disputed"
      : allConfirmed
        ? "confirmed"
        : "pending";

    let winnerEntityId = "";

    if (allConfirmed) {
      const homeStats = stats.get(homeTeamId);
      const awayStats = stats.get(awayTeamId);

      if (homeStats && awayStats) {
        homeStats.played += 1;
        awayStats.played += 1;

        homeStats.scoreFor += homeSetWins;
        homeStats.scoreAgainst += awaySetWins;

        awayStats.scoreFor += awaySetWins;
        awayStats.scoreAgainst += homeSetWins;

        if (homeGameWins > awayGameWins) {
          homeStats.wins += 1;
          awayStats.losses += 1;
          homeStats.points += WIN_POINTS;
          awayStats.points += LOSS_POINTS;
          winnerEntityId = homeTeamId;
        } else if (awayGameWins > homeGameWins) {
          awayStats.wins += 1;
          homeStats.losses += 1;
          awayStats.points += WIN_POINTS;
          homeStats.points += LOSS_POINTS;
          winnerEntityId = awayTeamId;
        }
      }

      completedResults.push({
        homeEntityId: homeTeamId,
        awayEntityId: awayTeamId,
        winnerEntityId,
      });
    }

    return {
      id: match.id,
      round: match.getInt("round"),
      sortOrder: match.getInt("sort_order"),

      status: match.getString("status"),
      resultStatus,

      homeEntity: teamsById.get(homeTeamId) || {
        id: homeTeamId,
        name: "삭제된 팀",
        sortOrder: 0,
      },

      awayEntity: teamsById.get(awayTeamId) || {
        id: awayTeamId,
        name: "삭제된 팀",
        sortOrder: 0,
      },

      homeScore: homeGameWins,
      awayScore: awayGameWins,

      winnerEntityId,
      games,
    };
  });

  const rows = [...stats.values()].map((row) => ({
    ...row,
    setRatio: getSetRatio(row.scoreFor, row.scoreAgainst),
  }));

  const standings = sortAndRankRows(rows, completedResults);

  return {
    competitionType: "team_league",
    entities,
    matches,
    standings,
  };
};

const buildIndividualStandings = function (dao, setting) {
  const participantRecords = dao.findRecordsByFilter(
    "event_participants",
    ["event = {:eventId}", "game_participation_status = 'playing'"].join(
      " && ",
    ),
    "created",
    500,
    0,
    {
      eventId: setting.getString("event"),
    },
  );

  const entities = participantRecords.map((participant) => ({
    id: participant.id,
    name: participant.getString("display_name") || "참가자",
    sortOrder: 0,
  }));

  const participantsById = new Map(
    entities.map((participant) => [participant.id, participant]),
  );

  const stats = new Map(
    entities.map((participant) => [
      participant.id,
      {
        entityId: participant.id,
        name: participant.name,

        played: 0,
        wins: 0,
        losses: 0,
        points: 0,
        headToHeadPoints: 0,

        scoreFor: 0,
        scoreAgainst: 0,
        setRatio: null,

        rank: 0,
      },
    ]),
  );

  const matchRecords = dao.findRecordsByFilter(
    "individual_matches",
    "game_setting = {:gameSettingId}",
    "sort_order",
    1000,
    0,
    {
      gameSettingId: setting.id,
    },
  );

  const completedResults = [];

  const matches = matchRecords.map((match) => {
    const homeParticipantId = match.getString("home_participant");

    const awayParticipantId = match.getString("away_participant");

    const resultStatus = match.getString("result_status") || "pending";

    const homeScore = match.getInt("home_score");

    const awayScore = match.getInt("away_score");

    let winnerEntityId = "";

    if (resultStatus === RESULT_CONFIRMED) {
      const homeStats = stats.get(homeParticipantId);

      const awayStats = stats.get(awayParticipantId);

      if (homeStats && awayStats) {
        homeStats.played += 1;
        awayStats.played += 1;

        homeStats.scoreFor += homeScore;
        homeStats.scoreAgainst += awayScore;

        awayStats.scoreFor += awayScore;
        awayStats.scoreAgainst += homeScore;

        if (match.getString("winner_side") === "home") {
          homeStats.wins += 1;
          awayStats.losses += 1;
          homeStats.points += WIN_POINTS;
          awayStats.points += LOSS_POINTS;
          winnerEntityId = homeParticipantId;
        } else {
          awayStats.wins += 1;
          homeStats.losses += 1;
          awayStats.points += WIN_POINTS;
          homeStats.points += LOSS_POINTS;
          winnerEntityId = awayParticipantId;
        }
      }

      completedResults.push({
        homeEntityId: homeParticipantId,
        awayEntityId: awayParticipantId,
        winnerEntityId,
      });
    }

    return {
      id: match.id,
      round: match.getInt("round"),
      sortOrder: match.getInt("sort_order"),

      status: match.getString("status"),
      resultStatus,

      homeEntity: participantsById.get(homeParticipantId) || {
        id: homeParticipantId,
        name: "삭제된 참가자",
        sortOrder: 0,
      },

      awayEntity: participantsById.get(awayParticipantId) || {
        id: awayParticipantId,
        name: "삭제된 참가자",
        sortOrder: 0,
      },

      bestOf: match.getInt("best_of"),

      homeScore,
      awayScore,

      winnerEntityId,

      submissionCount: getSubmissionCount(dao, "individual_match", match.id),

      games: [],
    };
  });

  const rows = [...stats.values()].map((row) => ({
    ...row,
    setRatio: getSetRatio(row.scoreFor, row.scoreAgainst),
  }));

  const standings = sortAndRankRows(rows, completedResults);

  return {
    competitionType: "individual_singles",
    entities,
    matches,
    standings,
  };
};

const buildStandingsBySetting = function (gameSettingId) {
  const dao = $app.dao();

  let setting;

  try {
    setting = dao.findRecordById("event_game_settings", gameSettingId);
  } catch {
    throw new NotFoundError("게임 설정을 찾을 수 없습니다.");
  }

  if (setting.getString("status") !== "confirmed") {
    throw new BadRequestError("게임 설정이 최종 확정되지 않았습니다.");
  }

  if (setting.getString("competition_type") === "team_league") {
    return buildTeamStandings(dao, setting);
  }

  return buildIndividualStandings(dao, setting);
};

const buildPublicStandings = function (responseToken) {
  const participant = getPublicParticipant(responseToken);

  const dao = $app.dao();

  const setting = getConfirmedSetting(dao, participant.getString("event"));

  return buildStandingsBySetting(setting.id);
};

module.exports = Object.freeze({
  buildStandingsBySetting,
  buildPublicStandings,
});
