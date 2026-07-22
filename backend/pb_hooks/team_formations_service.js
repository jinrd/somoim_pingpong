const findFormation = function (dao, gameSettingId) {
  try {
    return dao.findFirstRecordByFilter(
      "team_formations",
      "game_setting = {:gameSettingId}",
      { gameSettingId },
    );
  } catch {
    return null;
  }
};

const roundMetric = function (value) {
  return Math.round(value * 100) / 100;
};

const calculateQualityScore = function (teamInputs, participantsById, config) {
  if (teamInputs.length === 0) {
    return 0;
  }

  const teamSizes = teamInputs.map((team) => team.participantIds.length);

  const averageRanks = teamInputs.map((team) => {
    const totalRank = team.participantIds.reduce((total, participantId) => {
      const participant = participantsById.get(participantId);

      return total + participant.getInt("rank_snapshot");
    }, 0);

    return totalRank / team.participantIds.length;
  });

  const memberDifference = Math.max(...teamSizes) - Math.min(...teamSizes);

  const rankDifference = Math.max(...averageRanks) - Math.min(...averageRanks);

  return roundMetric(
    Math.max(
      0,
      config.TEAM_QUALITY_MAX_SCORE -
        rankDifference * config.TEAM_QUALITY_RANK_DIFFERENCE_PENALTY -
        memberDifference * config.TEAM_QUALITY_MEMBER_DIFFERENCE_PENALTY,
    ),
  );
};

const buildContextResponse = function (dao, gameSettingRecord) {
  const eventId = gameSettingRecord.getString("event");

  const gameSettingId = gameSettingRecord.id;

  const participantRecords = dao.findRecordsByFilter(
    "event_participants",
    ["event = {:eventId}", "game_participation_status = {:status}"].join(
      " && ",
    ),
    "rank_snapshot,display_name",
    500,
    0,
    {
      eventId,
      status: "playing",
    },
  );

  const participants = participantRecords.map((participant) => ({
    participantId: participant.id,
    participantType: participant.getString("participant_type"),
    displayName: participant.getString("display_name"),
    rankSnapshot: participant.getInt("rank_snapshot"),
  }));

  const formationRecord = findFormation(dao, gameSettingId);

  if (!formationRecord) {
    return {
      participants,
      formation: null,
      teams: [],
    };
  }

  const teamRecords = dao.findRecordsByFilter(
    "teams",
    "formation = {:formationId}",
    "sort_order",
    200,
    0,
    {
      formationId: formationRecord.id,
    },
  );

  const memberRecords = dao.findRecordsByFilter(
    "team_members",
    "formation = {:formationId}",
    "team,sort_order",
    1000,
    0,
    {
      formationId: formationRecord.id,
    },
  );

  const participantById = new Map(
    participantRecords.map((participant) => [participant.id, participant]),
  );

  const teams = teamRecords.map((team) => {
    const members = memberRecords
      .filter((member) => member.getString("team") === team.id)
      .map((member) => {
        const participantId = member.getString("participant");

        const participant = participantById.get(participantId);

        return {
          key: participantId,
          participantId,

          participantType: participant
            ? participant.getString("participant_type")
            : "guest",

          displayName: participant
            ? participant.getString("display_name")
            : "참가 상태가 변경된 인원",

          rankSnapshot: member.getInt("rank_snapshot"),
        };
      });

    return {
      key: team.id,
      id: team.id,
      name: team.getString("name"),
      sortOrder: team.getInt("sort_order"),
      members,
    };
  });

  return {
    participants,

    formation: {
      id: formationRecord.id,
      eventId,
      gameSettingId,

      method: formationRecord.getString("method"),

      status: formationRecord.getString("status"),

      qualityScore: formationRecord.getFloat("quality_score"),

      version: formationRecord.getInt("version"),
    },

    teams,
  };
};

module.exports = Object.freeze({
  findFormation,
  roundMetric,
  calculateQualityScore,
  buildContextResponse,
});
