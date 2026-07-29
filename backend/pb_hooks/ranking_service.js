/// <reference path="../pb_data/types.d.ts" />

const CANDIDATE_STATUS_PENDING = "pending";
const CANDIDATE_STATUS_APPROVED = "approved";
const CANDIDATE_STATUS_REJECTED = "rejected";
const CANDIDATE_STATUS_OBSOLETE = "obsolete";

const DIRECTION_PROMOTION = "promotion";
const DIRECTION_DEMOTION = "demotion";

const SOURCE_TEAM_GAME = "team_game";
const SOURCE_INDIVIDUAL_MATCH = "individual_match";

const getDisplayName = (record) => {
  if (!record) {
    return "참가자";
  }

  return (
    record.getString("nickname") ||
    record.getString("display_name") ||
    record.getString("name") ||
    "참가자"
  );
};

const getRankSettings = (dao) => {
  const records = dao.findRecordsByFilter(
    "rank_settings",
    "id != ''",
    "-updated",
    1,
    0,
  );

  if (records.length === 0) {
    throw new ApiError(400, "부수 승강 기준을 먼저 설정해 주세요.");
  }

  const record = records[0];

  return {
    minRank: record.getInt("min_rank"),
    maxRank: record.getInt("max_rank"),
    promotionThreshold: record.getInt("promotion_threshold"),
    demotionThreshold: record.getInt("demotion_threshold"),
  };
};

const serializeParticipant = (participantRecord) => {
  if (!participantRecord) {
    return null;
  }

  const memberId =
    participantRecord.getString("participant_type") === "member"
      ? participantRecord.getString("member")
      : "";

  return {
    participantId: participantRecord.id,
    memberId,
    name: getDisplayName(participantRecord),
    rankSnapshot: participantRecord.getInt("rank_snapshot"),
  };
};

const collectIndividualOfficialMatches = (dao) => {
  const records = dao.findRecordsByFilter(
    "individual_matches",
    [
      "counts_for_ranking = true",
      "result_status = 'confirmed'",
      "(winner_side = 'home' || winner_side = 'away')",
    ].join(" && "),
    "result_confirmed_at,id",
    5000,
    0,
  );

  return records
    .map((record) => {
      let homeParticipant;
      let awayParticipant;

      try {
        homeParticipant = dao.findRecordById(
          "event_participants",
          record.getString("home_participant"),
        );
        awayParticipant = dao.findRecordById(
          "event_participants",
          record.getString("away_participant"),
        );
      } catch {
        return null;
      }

      const home = serializeParticipant(homeParticipant);
      const away = serializeParticipant(awayParticipant);

      if (!home || !away) {
        return null;
      }

      return {
        key: `${SOURCE_INDIVIDUAL_MATCH}:${record.id}`,
        targetType: SOURCE_INDIVIDUAL_MATCH,
        targetId: record.id,
        eventId: record.getString("event"),
        confirmedAt:
          record.getString("result_confirmed_at") ||
          record.getString("updated"),
        home,
        away,
        homeScore: record.getInt("home_score"),
        awayScore: record.getInt("away_score"),
        winnerSide: record.getString("winner_side"),
      };
    })
    .filter(Boolean);
};

const findTeamGameSides = (dao, matchGameRecord, teamMatchRecord) => {
  const playerRecords = dao.findRecordsByFilter(
    "match_game_players",
    "match_game = {:matchGameId}",
    "position",
    10,
    0,
    {
      matchGameId: matchGameRecord.id,
    },
  );

  const homeParticipants = [];
  const awayParticipants = [];

  playerRecords.forEach((playerRecord) => {
    let lineupRecord;
    let participantRecord;

    try {
      lineupRecord = dao.findRecordById(
        "team_match_lineups",
        playerRecord.getString("lineup"),
      );
      participantRecord = dao.findRecordById(
        "event_participants",
        playerRecord.getString("participant"),
      );
    } catch {
      return;
    }

    const teamId = lineupRecord.getString("team");

    if (teamId === teamMatchRecord.getString("home_team")) {
      homeParticipants.push(participantRecord);
    }

    if (teamId === teamMatchRecord.getString("away_team")) {
      awayParticipants.push(participantRecord);
    }
  });

  if (homeParticipants.length !== 1 || awayParticipants.length !== 1) {
    return {
      home: null,
      away: null,
    };
  }

  return {
    home: serializeParticipant(homeParticipants[0]),
    away: serializeParticipant(awayParticipants[0]),
  };
};

const collectTeamOfficialMatches = (dao) => {
  const records = dao.findRecordsByFilter(
    "match_games",
    [
      "match_type = 'singles'",
      "counts_for_ranking = true",
      "result_status = 'confirmed'",
      "(winner_side = 'home' || winner_side = 'away')",
    ].join(" && "),
    "result_confirmed_at,id",
    5000,
    0,
  );

  return records
    .map((record) => {
      let teamMatchRecord;

      try {
        teamMatchRecord = dao.findRecordById(
          "team_matches",
          record.getString("team_match"),
        );
      } catch {
        return null;
      }

      const sides = findTeamGameSides(dao, record, teamMatchRecord);

      /*
       * 단식인데 한쪽에 선수가 없거나 두 명 이상으로 잘못 편성된 데이터는
       * 자동 승강 계산에서 제외하고 운영자가 먼저 라인업을 확인하도록 합니다.
       */
      if (!sides.home || !sides.away) {
        return null;
      }

      return {
        key: `${SOURCE_TEAM_GAME}:${record.id}`,
        targetType: SOURCE_TEAM_GAME,
        targetId: record.id,
        eventId: teamMatchRecord.getString("event"),
        confirmedAt:
          record.getString("result_confirmed_at") ||
          record.getString("updated"),
        home: sides.home,
        away: sides.away,
        homeScore: record.getInt("home_score"),
        awayScore: record.getInt("away_score"),
        winnerSide: record.getString("winner_side"),
      };
    })
    .filter(Boolean);
};

const collectOfficialMatches = (dao) => {
  return [
    ...collectIndividualOfficialMatches(dao),
    ...collectTeamOfficialMatches(dao),
  ].sort((left, right) => {
    const dateCompare = left.confirmedAt.localeCompare(right.confirmedAt);

    if (dateCompare !== 0) {
      return dateCompare;
    }

    return left.key.localeCompare(right.key);
  });
};

const getLastRankChangeMap = (dao) => {
  const records = dao.findRecordsByFilter(
    "member_rank_history",
    "id != ''",
    "effective_at,id",
    5000,
    0,
  );

  const result = new Map();

  records.forEach((record) => {
    result.set(record.getString("member"), record.getString("effective_at"));
  });

  return result;
};

const createPerformance = (memberRecord, lastRankChangeAt) => ({
  memberId: memberRecord.id,
  name: memberRecord.getString("name"),
  nickname: memberRecord.getString("nickname"),
  currentRank: memberRecord.getInt("rank"),
  status: memberRecord.getString("status"),
  officialMatchCount: 0,
  wins: 0,
  losses: 0,
  promotionStreak: 0,
  demotionStreak: 0,
  promotionTrigger: null,
  demotionTrigger: null,
  lastRankChangeAt: lastRankChangeAt || "",
  matches: [],
  qualification: null,
});

const updateStreak = (
  performance,
  match,
  didWin,
  ownRank,
  opponentRank,
  settings,
) => {
  if (
    performance.lastRankChangeAt &&
    match.confirmedAt <= performance.lastRankChangeAt
  ) {
    return;
  }

  const isPromotionWin = didWin && opponentRank < ownRank;
  const isDemotionLoss = !didWin && opponentRank > ownRank;

  if (isPromotionWin) {
    performance.promotionStreak += 1;

    if (performance.promotionStreak === settings.promotionThreshold) {
      performance.promotionTrigger = match;
    }
  } else {
    performance.promotionStreak = 0;
    performance.promotionTrigger = null;
  }

  if (isDemotionLoss) {
    performance.demotionStreak += 1;

    if (performance.demotionStreak === settings.demotionThreshold) {
      performance.demotionTrigger = match;
    }
  } else {
    performance.demotionStreak = 0;
    performance.demotionTrigger = null;
  }
};

const appendMemberMatch = (
  performance,
  match,
  ownSide,
  ownParticipant,
  opponentParticipant,
  eventTitle,
  settings,
) => {
  const didWin = match.winnerSide === ownSide;

  performance.officialMatchCount += 1;

  if (didWin) {
    performance.wins += 1;
  } else {
    performance.losses += 1;
  }

  const qualifiesFor =
    didWin && opponentParticipant.rankSnapshot < ownParticipant.rankSnapshot
      ? DIRECTION_PROMOTION
      : !didWin &&
          opponentParticipant.rankSnapshot > ownParticipant.rankSnapshot
        ? DIRECTION_DEMOTION
        : "";

  performance.matches.push({
    id: match.targetId,
    sourceType: match.targetType,
    eventId: match.eventId,
    eventTitle,
    confirmedAt: match.confirmedAt,
    opponentName: opponentParticipant.name,
    ownRank: ownParticipant.rankSnapshot,
    opponentRank: opponentParticipant.rankSnapshot,
    outcome: didWin ? "win" : "loss",
    qualifiesFor,
    ownScore: ownSide === "home" ? match.homeScore : match.awayScore,
    opponentScore: ownSide === "home" ? match.awayScore : match.homeScore,
  });

  updateStreak(
    performance,
    match,
    didWin,
    ownParticipant.rankSnapshot,
    opponentParticipant.rankSnapshot,
    settings,
  );
};

const buildPerformanceMap = (dao) => {
  const settings = getRankSettings(dao);
  const members = dao.findRecordsByFilter(
    "members",
    "id != ''",
    "nickname,name",
    5000,
    0,
  );
  const lastRankChangeMap = getLastRankChangeMap(dao);
  const performanceMap = new Map();
  const eventTitleMap = new Map();

  members.forEach((memberRecord) => {
    performanceMap.set(
      memberRecord.id,
      createPerformance(memberRecord, lastRankChangeMap.get(memberRecord.id)),
    );
  });

  const getEventTitle = (eventId) => {
    if (eventTitleMap.has(eventId)) {
      return eventTitleMap.get(eventId);
    }

    let title = "회차";

    try {
      title = dao.findRecordById("events", eventId).getString("title") || title;
    } catch {
      // 삭제된 회차의 이력은 기본 이름으로 표시합니다.
    }

    eventTitleMap.set(eventId, title);
    return title;
  };

  collectOfficialMatches(dao).forEach((match) => {
    const eventTitle = getEventTitle(match.eventId);

    if (match.home.memberId && performanceMap.has(match.home.memberId)) {
      appendMemberMatch(
        performanceMap.get(match.home.memberId),
        match,
        "home",
        match.home,
        match.away,
        eventTitle,
        settings,
      );
    }

    if (match.away.memberId && performanceMap.has(match.away.memberId)) {
      appendMemberMatch(
        performanceMap.get(match.away.memberId),
        match,
        "away",
        match.away,
        match.home,
        eventTitle,
        settings,
      );
    }
  });

  performanceMap.forEach((performance) => {
    if (performance.status !== "active") {
      return;
    }

    if (
      performance.promotionStreak >= settings.promotionThreshold &&
      performance.promotionTrigger &&
      performance.currentRank > settings.minRank
    ) {
      performance.qualification = {
        direction: DIRECTION_PROMOTION,
        streakCount: performance.promotionStreak,
        threshold: settings.promotionThreshold,
        proposedRank: performance.currentRank - 1,
        trigger: performance.promotionTrigger,
      };
      return;
    }

    if (
      performance.demotionStreak >= settings.demotionThreshold &&
      performance.demotionTrigger &&
      performance.currentRank < settings.maxRank
    ) {
      performance.qualification = {
        direction: DIRECTION_DEMOTION,
        streakCount: performance.demotionStreak,
        threshold: settings.demotionThreshold,
        proposedRank: performance.currentRank + 1,
        trigger: performance.demotionTrigger,
      };
    }
  });

  return {
    settings,
    performanceMap,
  };
};

const markCandidateObsolete = (dao, candidateRecord) => {
  candidateRecord.set("status", CANDIDATE_STATUS_OBSOLETE);
  candidateRecord.set("reviewed_at", new Date().toISOString());
  candidateRecord.set("review_note", "현재 공식 단식 결과와 조건이 달라졌습니다.");
  candidateRecord.set("version", candidateRecord.getInt("version") + 1);
  dao.saveRecord(candidateRecord);
};

const applyQualificationToCandidate = (
  candidateRecord,
  performance,
  qualification,
) => {
  candidateRecord.set("direction", qualification.direction);
  candidateRecord.set("current_rank", performance.currentRank);
  candidateRecord.set("proposed_rank", qualification.proposedRank);
  candidateRecord.set("streak_count", qualification.streakCount);
  candidateRecord.set("threshold", qualification.threshold);
  candidateRecord.set("source_type", qualification.trigger.targetType);
  candidateRecord.set(
    "match_game",
    qualification.trigger.targetType === SOURCE_TEAM_GAME
      ? qualification.trigger.targetId
      : "",
  );
  candidateRecord.set(
    "individual_match",
    qualification.trigger.targetType === SOURCE_INDIVIDUAL_MATCH
      ? qualification.trigger.targetId
      : "",
  );
  candidateRecord.set(
    "basis_key",
    `${qualification.trigger.key}:${qualification.direction}`,
  );
  candidateRecord.set("calculated_at", new Date().toISOString());
};

const syncMemberCandidate = (dao, performance) => {
  const candidateRecords = dao.findRecordsByFilter(
    "ranking_adjustment_candidates",
    "member = {:memberId}",
    "-created",
    500,
    0,
    {
      memberId: performance.memberId,
    },
  );

  const qualification = performance.qualification;
  const basisKey = qualification
    ? `${qualification.trigger.key}:${qualification.direction}`
    : "";

  candidateRecords
    .filter(
      (record) =>
        record.getString("status") === CANDIDATE_STATUS_PENDING &&
        record.getString("basis_key") !== basisKey,
    )
    .forEach((record) => {
      markCandidateObsolete(dao, record);
    });

  if (!qualification) {
    return null;
  }

  const existingRecord = candidateRecords.find(
    (record) => record.getString("basis_key") === basisKey,
  );

  if (existingRecord) {
    const status = existingRecord.getString("status");

    if (
      status === CANDIDATE_STATUS_REJECTED ||
      status === CANDIDATE_STATUS_APPROVED
    ) {
      return existingRecord;
    }

    applyQualificationToCandidate(existingRecord, performance, qualification);
    existingRecord.set("status", CANDIDATE_STATUS_PENDING);
    existingRecord.set("reviewed_by", "");
    existingRecord.set("reviewed_at", "");
    existingRecord.set("review_note", "");
    existingRecord.set("version", existingRecord.getInt("version") + 1);
    dao.saveRecord(existingRecord);

    return existingRecord;
  }

  const collection = dao.findCollectionByNameOrId(
    "ranking_adjustment_candidates",
  );
  const candidateRecord = new Record(collection);

  candidateRecord.set("member", performance.memberId);
  applyQualificationToCandidate(candidateRecord, performance, qualification);
  candidateRecord.set("status", CANDIDATE_STATUS_PENDING);
  candidateRecord.set("version", 1);

  dao.saveRecord(candidateRecord);

  return candidateRecord;
};

const recalculateAllCandidates = (dao) => {
  const { performanceMap } = buildPerformanceMap(dao);

  performanceMap.forEach((performance) => {
    syncMemberCandidate(dao, performance);
  });

  return performanceMap;
};

const recalculateMemberCandidate = (dao, memberId) => {
  const { performanceMap } = buildPerformanceMap(dao);
  const performance = performanceMap.get(memberId);

  if (!performance) {
    throw new ApiError(404, "회원을 찾을 수 없습니다.");
  }

  syncMemberCandidate(dao, performance);

  return performance;
};

const serializeCandidate = (dao, candidateRecord) => {
  const memberRecord = dao.findRecordById(
    "members",
    candidateRecord.getString("member"),
  );

  let reviewedByName = "";
  const reviewedById = candidateRecord.getString("reviewed_by");

  if (reviewedById) {
    try {
      const reviewer = dao.findRecordById("users", reviewedById);
      reviewedByName =
        reviewer.getString("name") || reviewer.getString("email");
    } catch {
      // 삭제되거나 비활성화된 과거 관리자일 수 있습니다.
    }
  }

  return {
    id: candidateRecord.id,
    memberId: memberRecord.id,
    memberName: memberRecord.getString("name"),
    memberNickname: memberRecord.getString("nickname"),
    direction: candidateRecord.getString("direction"),
    currentRank: candidateRecord.getInt("current_rank"),
    proposedRank: candidateRecord.getInt("proposed_rank"),
    streakCount: candidateRecord.getInt("streak_count"),
    threshold: candidateRecord.getInt("threshold"),
    status: candidateRecord.getString("status"),
    sourceType: candidateRecord.getString("source_type"),
    calculatedAt: candidateRecord.getString("calculated_at"),
    reviewedAt: candidateRecord.getString("reviewed_at"),
    reviewedByName,
    reviewNote: candidateRecord.getString("review_note"),
    version: candidateRecord.getInt("version"),
  };
};

const getPendingCandidateMap = (dao) => {
  const records = dao.findRecordsByFilter(
    "ranking_adjustment_candidates",
    "status = 'pending'",
    "calculated_at",
    5000,
    0,
  );
  const result = new Map();

  records.forEach((record) => {
    result.set(record.getString("member"), serializeCandidate(dao, record));
  });

  return result;
};

const serializePerformanceSummary = (performance, candidate) => ({
  memberId: performance.memberId,
  name: performance.name,
  nickname: performance.nickname,
  currentRank: performance.currentRank,
  status: performance.status,
  officialMatchCount: performance.officialMatchCount,
  wins: performance.wins,
  losses: performance.losses,
  promotionStreak: performance.promotionStreak,
  demotionStreak: performance.demotionStreak,
  lastRankChangeAt: performance.lastRankChangeAt,
  pendingCandidate: candidate || null,
});

const getRankingOverview = (dao) => {
  const { settings, performanceMap } = buildPerformanceMap(dao);
  const pendingCandidateMap = getPendingCandidateMap(dao);
  const members = Array.from(performanceMap.values()).map((performance) =>
    serializePerformanceSummary(
      performance,
      pendingCandidateMap.get(performance.memberId),
    ),
  );

  members.sort((left, right) => {
    return (
      left.currentRank - right.currentRank ||
      left.nickname.localeCompare(right.nickname)
    );
  });

  return {
    settings,
    pendingCandidateCount: pendingCandidateMap.size,
    officialMatchCount: collectOfficialMatches(dao).length,
    members,
    pendingCandidates: Array.from(pendingCandidateMap.values()),
  };
};

const serializeRankHistory = (dao, record) => {
  let approvedByName = "";
  const approvedById = record.getString("approved_by");

  if (approvedById) {
    try {
      const adminRecord = dao.findRecordById("users", approvedById);
      approvedByName =
        adminRecord.getString("name") || adminRecord.getString("email");
    } catch {
      // 과거 관리자 정보가 없으면 빈 이름으로 표시합니다.
    }
  }

  return {
    id: record.id,
    previousRank: record.getInt("previous_rank"),
    newRank: record.getInt("new_rank"),
    direction: record.getString("direction"),
    reason: record.getString("reason"),
    approvedByName,
    effectiveAt: record.getString("effective_at"),
  };
};

const getMemberRankingDetail = (dao, memberId) => {
  const { performanceMap } = buildPerformanceMap(dao);
  const performance = performanceMap.get(memberId);

  if (!performance) {
    throw new ApiError(404, "회원을 찾을 수 없습니다.");
  }

  const pendingCandidateMap = getPendingCandidateMap(dao);
  const historyRecords = dao.findRecordsByFilter(
    "member_rank_history",
    "member = {:memberId}",
    "-effective_at,-created",
    500,
    0,
    {
      memberId,
    },
  );

  return {
    member: serializePerformanceSummary(
      performance,
      pendingCandidateMap.get(memberId),
    ),
    matches: [...performance.matches].reverse(),
    rankHistory: historyRecords.map((record) =>
      serializeRankHistory(dao, record),
    ),
  };
};

const assertReviewInput = (candidateRecord, input) => {
  const expectedVersion = Number(input.expectedVersion);
  const note = String(input.note || "").trim();

  if (
    !Number.isInteger(expectedVersion) ||
    expectedVersion < 1 ||
    candidateRecord.getInt("version") !== expectedVersion
  ) {
    throw new ApiError(
      409,
      "후보 정보가 변경되었습니다. 새로고침 후 다시 시도해 주세요.",
    );
  }

  if (note.length > 500) {
    throw new ApiError(400, "검토 메모는 500자 이하로 입력해 주세요.");
  }

  if (candidateRecord.getString("status") !== CANDIDATE_STATUS_PENDING) {
    throw new ApiError(409, "이미 검토가 끝난 후보입니다.");
  }

  return note;
};

const reviewCandidate = (candidateId, input, action) => {
  let memberId = "";
  let reviewConflictMessage = "";

  $app.dao().runInTransaction((txDao) => {
    let candidateRecord;

    try {
      candidateRecord = txDao.findRecordById(
        "ranking_adjustment_candidates",
        candidateId,
      );
    } catch {
      throw new ApiError(404, "승강 후보를 찾을 수 없습니다.");
    }

    const note = assertReviewInput(candidateRecord, input);
    const now = new Date().toISOString();

    memberId = candidateRecord.getString("member");

    if (action === CANDIDATE_STATUS_REJECTED) {
      candidateRecord.set("status", CANDIDATE_STATUS_REJECTED);
      candidateRecord.set("reviewed_by", input.adminId);
      candidateRecord.set("reviewed_at", now);
      candidateRecord.set("review_note", note || "운영자 반려");
      candidateRecord.set("version", candidateRecord.getInt("version") + 1);

      txDao.saveRecord(candidateRecord);
      return;
    }

    const memberRecord = txDao.findRecordById("members", memberId);

    if (memberRecord.getString("status") !== "active") {
      throw new ApiError(409, "비활동 회원의 부수는 변경할 수 없습니다.");
    }

    const currentRank = candidateRecord.getInt("current_rank");
    const proposedRank = candidateRecord.getInt("proposed_rank");

    if (memberRecord.getInt("rank") !== currentRank) {
      candidateRecord.set("status", CANDIDATE_STATUS_OBSOLETE);
      candidateRecord.set("reviewed_at", now);
      candidateRecord.set(
        "review_note",
        "회원 부수가 이미 변경되어 후보를 적용할 수 없습니다.",
      );
      candidateRecord.set("version", candidateRecord.getInt("version") + 1);
      txDao.saveRecord(candidateRecord);

      reviewConflictMessage =
        "회원 부수가 이미 변경되었습니다. 후보를 다시 계산해 주세요.";
      return;
    }

    const settings = getRankSettings(txDao);

    if (proposedRank < settings.minRank || proposedRank > settings.maxRank) {
      throw new ApiError(400, "변경할 부수가 현재 승강 범위를 벗어났습니다.");
    }

    const expectedProposedRank =
      candidateRecord.getString("direction") === DIRECTION_PROMOTION
        ? currentRank - 1
        : currentRank + 1;

    if (proposedRank !== expectedProposedRank) {
      throw new ApiError(400, "한 번에 한 단계만 승급 또는 강등할 수 있습니다.");
    }

    memberRecord.set("rank", proposedRank);
    txDao.saveRecord(memberRecord);

    candidateRecord.set("status", CANDIDATE_STATUS_APPROVED);
    candidateRecord.set("reviewed_by", input.adminId);
    candidateRecord.set("reviewed_at", now);
    candidateRecord.set("review_note", note || "운영자 승인");
    candidateRecord.set("version", candidateRecord.getInt("version") + 1);
    txDao.saveRecord(candidateRecord);

    const historyCollection =
      txDao.findCollectionByNameOrId("member_rank_history");
    const historyRecord = new Record(historyCollection);
    const direction = candidateRecord.getString("direction");

    historyRecord.set("member", memberRecord.id);
    historyRecord.set("candidate", candidateRecord.id);
    historyRecord.set("previous_rank", currentRank);
    historyRecord.set("new_rank", proposedRank);
    historyRecord.set("direction", direction);
    historyRecord.set(
      "reason",
      note ||
        (direction === DIRECTION_PROMOTION
          ? `상위 부수 상대 ${candidateRecord.getInt("threshold")}연승 승인`
          : `하위 부수 상대 ${candidateRecord.getInt("threshold")}연패 승인`),
    );
    historyRecord.set("approved_by", input.adminId);
    historyRecord.set("effective_at", now);

    txDao.saveRecord(historyRecord);

    const otherPendingCandidates = txDao.findRecordsByFilter(
      "ranking_adjustment_candidates",
      "member = {:memberId} && status = 'pending' && id != {:candidateId}",
      "",
      500,
      0,
      {
        memberId,
        candidateId: candidateRecord.id,
      },
    );

    otherPendingCandidates.forEach((record) => {
      markCandidateObsolete(txDao, record);
    });
  });

  /*
   * 트랜잭션 안에서 예외를 던지면 obsolete 저장까지 롤백되므로,
   * 상태 변경을 먼저 확정한 뒤 충돌 응답을 반환합니다.
   */
  if (reviewConflictMessage) {
    throw new ApiError(409, reviewConflictMessage);
  }

  recalculateMemberCandidate($app.dao(), memberId);

  return getMemberRankingDetail($app.dao(), memberId);
};

const approveCandidate = (candidateId, input) => {
  return reviewCandidate(candidateId, input, CANDIDATE_STATUS_APPROVED);
};

const rejectCandidate = (candidateId, input) => {
  return reviewCandidate(candidateId, input, CANDIDATE_STATUS_REJECTED);
};

const recordManualRankChange = (
  dao,
  memberRecord,
  previousRank,
  adminId,
) => {
  const newRank = memberRecord.getInt("rank");

  if (previousRank === newRank) {
    return;
  }

  const collection = dao.findCollectionByNameOrId("member_rank_history");
  const historyRecord = new Record(collection);
  const now = new Date().toISOString();

  historyRecord.set("member", memberRecord.id);
  historyRecord.set("candidate", "");
  historyRecord.set("previous_rank", previousRank);
  historyRecord.set("new_rank", newRank);
  historyRecord.set("direction", "manual");
  historyRecord.set("reason", "운영자가 회원 정보에서 부수를 직접 변경했습니다.");
  historyRecord.set("approved_by", adminId || "");
  historyRecord.set("effective_at", now);

  dao.saveRecord(historyRecord);

  recalculateMemberCandidate(dao, memberRecord.id);
};

module.exports = Object.freeze({
  approveCandidate,
  getMemberRankingDetail,
  getRankingOverview,
  recordManualRankChange,
  recalculateAllCandidates,
  recalculateMemberCandidate,
  rejectCandidate,
});
