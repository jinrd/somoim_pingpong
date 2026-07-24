// @ts-nocheck
/// <reference path="../pb_data/types.d.ts" />

/*
 * 개인 단식 풀리그 대진 저장 또는 재생성
 *
 * PUT /api/somoim/admin/game-settings/:gameSettingId/individual-schedule
 */
routerAdd(
  "PUT",
  "/api/somoim/admin/game-settings/:gameSettingId/individual-schedule",
  (context) => {
    const gameSettingId = context.pathParam("gameSettingId");

    const requestData = new DynamicModel({
      expectedScheduleVersion: 0,
      matches: [],
    });

    context.bind(requestData);

    const expectedScheduleVersion = Number(
      requestData.expectedScheduleVersion || 0,
    );

    const submittedMatches = requestData.matches;

    if (
      !Number.isInteger(expectedScheduleVersion) ||
      expectedScheduleVersion < 0
    ) {
      throw new BadRequestError("대진표 버전 정보가 올바르지 않습니다.");
    }

    if (!Array.isArray(submittedMatches) || submittedMatches.length === 0) {
      throw new BadRequestError("저장할 대진 정보가 없습니다.");
    }

    const dao = $app.dao();

    /*
     * 1. 게임 설정 확인
     */
    const gameSetting = dao.findRecordById(
      "event_game_settings",
      gameSettingId,
    );

    if (gameSetting.getString("competition_type") !== "individual_singles") {
      throw new BadRequestError(
        "개인 단식 풀리그 설정에서만 개인 대진을 만들 수 있습니다.",
      );
    }

    if (gameSetting.getString("status") !== "confirmed") {
      throw new BadRequestError("게임 설정을 먼저 확정해 주세요.");
    }

    const eventId = gameSetting.getString("event");

    /*
     * 2. 현재 대진표 진행 상태 확인
     */
    const existingMatches = dao.findRecordsByFilter(
      "individual_matches",
      "game_setting = {:gameSettingId}",
      "",
      500,
      0,
      {
        gameSettingId,
      },
    );
    const currentScheduleVersion =
      existingMatches.length > 0
        ? Math.max(...existingMatches.map((m) => m.getInt("version")))
        : 0;

    if (currentScheduleVersion !== expectedScheduleVersion) {
      throw new ApiError(
        409,
        "다른 사람이 대진표를 먼저 수정했습니다. 새 고침 후 다시 시도해 주세요.",
      );
    }

    if (
      existingMatches.some(
        (match) => !["scheduled", "ready"].includes(match.getString("status")),
      )
    ) {
      throw new BadRequestError(
        "진행 중이거나 완료된 경기가 있어 대진표를 바꿀 수 없습니다.",
      );
    }

    /*
     * 3. 현재 참가자 목록(게임 참가 상태) 확인
     */
    const participantRecords = dao.findRecordsByFilter(
      "event_participants",
      "event = {:eventId} && game_participation_status = 'playing'",
      "created",
      100,
      0,
      {
        eventId,
      },
    );
    if (participantRecords.length < 2) {
      throw new BadRequestError(
        "대진을 생성하려면 게임에 참가(playing)하는 인원이 최소 2명 필요합니다.",
      );
    }

    const participantsById = new Map(participantRecords.map((p) => [p.id, p]));
    const expectedMatchCount =
      (participantRecords.length * (participantRecords.length - 1)) / 2;

    if (submittedMatches.length !== expectedMatchCount) {
      throw new BadRequestError(
        `전체 대진은 ${expectedMatchCount}경기여야 합니다. (참가 상태가 변경된 참가자가 있을 수 있습니다)`,
      );
    }

    /*
     * 4. 클라이언트가 보낸 대진 검증
     */
    const normalizedMatches = submittedMatches.map((submittedMatch, index) => {
      if (!submittedMatch || typeof submittedMatch !== "object") {
        throw new BadRequestError(
          `${index + 1}번째 대진 정보가 올바르지 않습니다.`,
        );
      }

      const homeParticipantId = String(submittedMatch.homeParticipantId || "");
      const awayParticipantId = String(submittedMatch.awayParticipantId || "");

      const round = Number(submittedMatch.round || 0);
      const sortOrder = Number(submittedMatch.sortOrder || 0);

      if (
        !participantsById.has(homeParticipantId) ||
        !participantsById.has(awayParticipantId)
      ) {
        throw new BadRequestError(
          "현재 게임 참가(playing) 상태가 아닌 참가자가 대진에 포함되어 있습니다.",
        );
      }

      if (homeParticipantId === awayParticipantId) {
        throw new BadRequestError("본인과 대결할 수는 없습니다.");
      }

      if (!Number.isInteger(round) || round < 1) {
        throw new BadRequestError(
          `${index + 1}번째 대진의 라운드가 올바르지 않습니다.`,
        );
      }

      if (!Number.isInteger(sortOrder) || sortOrder < 1) {
        throw new BadRequestError(
          `${index + 1}번째 대진 순서가 올바르지 않습니다.`,
        );
      }
      const pairKey = [homeParticipantId, awayParticipantId].sort().join(":");
      return {
        homeParticipantId,
        awayParticipantId,
        pairKey,
        round,
        sortOrder,
      };
    });

    /*
     * 5. 중복 검사
     */
    const submittedPairKeys = normalizedMatches.map((match) => match.pairKey);

    // submittedPairKeys 가 뭘 지징하는거지?
    if (new Set(submittedPairKeys).size !== submittedPairKeys.length) {
      throw new BadRequestError("동일한 대결 조합이 중복되어 있습니다.");
    }

    const expectedPairKeys = [];

    for (
      let leftIndex = 0;
      leftIndex < participantRecords.length;
      leftIndex += 1
    ) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < participantRecords.length;
        rightIndex += 1
      ) {
        expectedPairKeys.push(
          [participantRecords[leftIndex].id, participantRecords[rightIndex].id]
            .sort()
            .join(":"),
        );
      }
    }
    if (
      expectedPairKeys.some((pairKey) => !submittedPairKeys.includes(pairKey))
    ) {
      throw new BadRequestError("일부 대결 조합이 대진표에서 누락되었습니다.");
    }

    /*
     * 6. 대진표 트랜잭션 저장
     */
    const nextScheduleVersion = currentScheduleVersion + 1;
    const individualBestOf = gameSetting.getInt("individual_best_of") || 3;
    const individualCountsForRanking = gameSetting.getBool(
      "individual_counts_for_ranking",
    );

    $app.dao().runInTransaction((transactionDao) => {
      const individualMatches =
        transactionDao.findCollectionByNameOrId("individual_matches");

      const matchesToDelete = transactionDao.findRecordsByFilter(
        "individual_matches",
        "game_setting = {:gameSettingId}",
        "",
        500,
        0,
        {
          gameSettingId,
        },
      );

      matchesToDelete.forEach((match) => {
        transactionDao.deleteRecord(match);
      });
      normalizedMatches
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .forEach((matchInput) => {
          const individualMatch = new Record(individualMatches);
          individualMatch.set("event", eventId);
          individualMatch.set("game_setting", gameSettingId);
          individualMatch.set("home_participant", matchInput.homeParticipantId);
          individualMatch.set("away_participant", matchInput.awayParticipantId);
          individualMatch.set("pair_key", matchInput.pairKey);
          individualMatch.set("round", matchInput.round);
          individualMatch.set("sort_order", matchInput.sortOrder);

          individualMatch.set("best_of", individualBestOf);
          individualMatch.set("counts_for_ranking", individualCountsForRanking);
          individualMatch.set("status", "scheduled");
          individualMatch.set("version", nextScheduleVersion);
          transactionDao.saveRecord(individualMatch);
        });
    });

    return context.json(200, {
      scheduleVersion: nextScheduleVersion,
      totalRoundCount: Math.max(...normalizedMatches.map((m) => m.round)),
      totalMatchCount: normalizedMatches.length,
    });
  } /* middlewares */,
  $apis.requireRecordAuth("users"),
);

/*
 * 개인 단식 풀리그 대진 조회
 *
 * GET /api/somoim/admin/game-settings/:gameSettingId/individual-schedule
 */
routerAdd(
  "GET",
  "/api/somoim/admin/game-settings/:gameSettingId/individual-schedule",
  (context) => {
    const gameSettingId = context.pathParam("gameSettingId");
    const dao = $app.dao();
    const gameSetting = dao.findRecordById(
      "event_game_settings",
      gameSettingId,
    );

    if (gameSetting.getString("competition_type") !== "individual_singles") {
      throw new BadRequestError(
        "개인 단식 풀리그 설정에서만 대진을 조회할 수 있습니다.",
      );
    }

    const eventId = gameSetting.getString("event");
    const participantRecords = dao.findRecordsByFilter(
      "event_participants",
      "event = {:eventId} && game_participation_status = 'playing'",
      "created",
      100,
      0,
      {
        eventId,
      },
    );

    // 참가자 목록 정렬 (프론트엔드에서 휴식자 계산 및 렌더링에 사용)
    const participants = participantRecords.map((p) => ({
      id: p.id,
      name: p.getString("display_name"),
      sortOrder: p.getInt("created"),
    }));

    const participantsById = new Map(participants.map((p) => [p.id, p]));

    const matchRecords = dao.findRecordsByFilter(
      "individual_matches",
      "game_setting = {:gameSettingId}",
      "sort_order",
      500,
      0,
      {
        gameSettingId,
      },
    );

    const matches = matchRecords.map((match) => {
      const homeParticipantId = match.getString("home_participant");
      const awayParticipantId = match.getString("away_participant");
      return {
        id: match.id,
        pairKey: match.getString("pair_key"),
        round: match.getInt("round"),
        sortOrder: match.getInt("sort_order"),
        status: match.getString("status"),
        version: match.getInt("version"),
        bestOf: match.getInt("best_of"),
        countsForRanking: match.getBool("counts_for_ranking"),
        homeParticipant: participantsById.get(homeParticipantId) || {
          id: homeParticipantId,
          name: "삭제된 참가자",
          sortOrder: 0,
        },
        awayParticipant: participantsById.get(awayParticipantId) || {
          id: awayParticipantId,
          name: "삭제된 참가자",
          sortOrder: 0,
        },
      };
    });

    const scheduleVersion =
      matches.length > 0 ? Math.max(...matches.map((m) => m.version)) : 0;
    const maxRound =
      matches.length > 0 ? Math.max(...matches.map((m) => m.round)) : 0;

    // 라운드별로 데이터 조립 및 휴식자 계산
    const rounds = [];

    for (let round = 1; round <= maxRound; round += 1) {
      const roundMatches = matches.filter((m) => m.round === round);

      const playingParticipantsInRound = new Set([
        ...roundMatches.map((m) => m.homeParticipant.id),
        ...roundMatches.map((m) => m.awayParticipant.id),
      ]);

      // 해당 라운드 경기에 참여하지 않는 사람이 휴식자(Bye)
      const byeParticipant =
        participants.find((p) => !playingParticipantsInRound.has(p.id)) || null;
      rounds.push({
        round,
        matches: roundMatches,
        byeParticipant,
      });
    }
    const canRegenerate =
      matches.length > 0 &&
      matches.every((m) => ["scheduled", "ready"].includes(m.status));
    return context.json(200, {
      eventId,
      gameSettingId,

      participants,
      scheduleVersion,
      totalRoundCount: maxRound,
      totalMatchCount: matches.length,
      canRegenerate,
      rounds,
    });
  } /* middlewares */,
  $apis.requireRecordAuth("users"),
);

/*
 * 본인이 속한 개인 단식 전체 경기 목록 조회 (공용 링크용)
 *
 * POST /api/somoim/public/individual-matches/mine
 */
routerAdd("POST", "/api/somoim/public/individual-matches/mine", (context) => {
  const requestData = new DynamicModel({
    responseToken: "",
  });

  context.bind(requestData);

  const teamService = require(`${__hooks}/team_lineups_service.js`);
  const dao = $app.dao();

  const participantRecord = teamService.findParticipantByResponseToken(
    requestData.responseToken,
  );

  const eventId = participantRecord.getString("event");

  // 1. 모든 참가자 정보를 먼저 가져옵니다 (상대방 이름 매핑용)
  const allParticipantRecords = dao.findRecordsByFilter(
    "event_participants",
    "event = {:eventId}",
    "",
    500,
    0,
    { eventId },
  );

  const participantsById = new Map();
  allParticipantRecords.forEach((p) => {
    participantsById.set(p.id, p);
  });

  // 2. 내 경기 목록 조회
  const matchRecords = dao.findRecordsByFilter(
    "individual_matches",
    "(home_participant = {:participantId} || away_participant = {:participantId})",
    "sort_order",
    500,
    0,
    { participantId: participantRecord.id },
  );

  const matches = matchRecords.map((matchRecord) => {
    const homeId = matchRecord.getString("home_participant");
    const awayId = matchRecord.getString("away_participant");

    const opponentId = homeId === participantRecord.id ? awayId : homeId;
    const opponentRecord = participantsById.get(opponentId);

    return {
      id: matchRecord.id,
      round: matchRecord.getInt("round"),
      sortOrder: matchRecord.getInt("sort_order"),
      status: matchRecord.getString("status"),
      isHomeTeam: homeId === participantRecord.id,
      opponentTeam: {
        id: opponentRecord ? opponentRecord.id : opponentId,
        name: opponentRecord
          ? opponentRecord.getString("display_name")
          : "삭제된 참가자",
      },
      ownLineupStatus: "confirmed",
      opponentLineupStatus: "confirmed",
    };
  });

  return context.json(200, {
    eventId,
    competitionType: "individual_singles",
    participant: {
      id: participantRecord.id,
      name: participantRecord.getString("display_name"),
    },
    matches,
  });
});
