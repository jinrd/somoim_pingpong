/// <reference path="../pb_data/types.d.ts" />

/*
 * 팀 풀리그 전체 대진 저장 또는 재생성
 *
 * PUT /api/somoim/admin/game-settings/:gameSettingId/team-schedule
 */
routerAdd(
  "PUT",
  "/api/somoim/admin/game-settings/:gameSettingId/team-schedule",
  (context) => {
    const gameSettingId = context.pathParam("gameSettingId");

    /** @type {any} */
    const requestData = new DynamicModel({
      expectedFormationVersion: 0,
      expectedScheduleVersion: 0,
      matches: [],
    });

    context.bind(requestData);

    const expectedFormationVersion = Number(
      requestData.expectedFormationVersion || 0,
    );

    const expectedScheduleVersion = Number(
      requestData.expectedScheduleVersion || 0,
    );

    const submittedMatches = requestData.matches;

    if (
      !Number.isInteger(expectedFormationVersion) ||
      expectedFormationVersion < 1
    ) {
      throw new BadRequestError("팀 편성 버전 정보가 올바르지 않습니다.");
    }

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

    if (gameSetting.getString("competition_type") !== "team_league") {
      throw new BadRequestError(
        "팀 리그 설정에서만 팀 대진을 만들 수 있습니다.",
      );
    }

    if (gameSetting.getString("status") !== "confirmed") {
      throw new BadRequestError("게임 설정을 먼저 확정해 주세요.");
    }

    const eventId = gameSetting.getString("event");

    /*
     * 2. 확정된 팀 편성 확인
     */
    let formation;

    try {
      formation = dao.findFirstRecordByFilter(
        "team_formations",
        "game_setting = {:gameSettingId}",
        {
          gameSettingId,
        },
      );
    } catch {
      throw new BadRequestError("저장된 팀 편성 정보를 찾을 수 없습니다.");
    }

    if (formation.getString("status") !== "confirmed") {
      throw new BadRequestError("팀 편성을 먼저 확정해 주세요.");
    }

    if (formation.getInt("version") !== expectedFormationVersion) {
      throw new ApiError(
        409,
        "팀 편성이 변경되었습니다. 팀 편성과 대진을 다시 불러와 주세요.",
      );
    }

    /*
     * 3. 현재 팀 목록 확인
     */
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

    if (teamRecords.length < 2) {
      throw new BadRequestError("대진을 생성하려면 팀이 최소 2개 필요합니다.");
    }

    const teamsById = new Map(teamRecords.map((team) => [team.id, team]));

    /*
     * n개의 팀으로 단일 풀리그를 만들면
     * 전체 경기 수는 n(n-1)/2입니다.
     */
    const expectedMatchCount =
      (teamRecords.length * (teamRecords.length - 1)) / 2;

    if (submittedMatches.length !== expectedMatchCount) {
      throw new BadRequestError(
        `전체 대진은 ${expectedMatchCount}경기여야 합니다.`,
      );
    }

    /*
     * 4. 세부 경기 형식 확인
     */
    const formatRecords = dao.findRecordsByFilter(
      "event_match_formats",
      "game_setting = {:gameSettingId}",
      "sequence",
      100,
      0,
      {
        gameSettingId,
      },
    );

    if (formatRecords.length === 0) {
      throw new BadRequestError("단식·복식 세부 경기 설정을 찾을 수 없습니다.");
    }

    const formatSnapshot = formatRecords.map((format) => ({
      sequence: format.getInt("sequence"),
      matchType: format.getString("match_type"),
      bestOf: format.getInt("best_of"),
      countsForRanking: format.getBool("counts_for_ranking"),
    }));

    const formatSnapshotJson = JSON.stringify(formatSnapshot);

    /*
     * 5. 클라이언트가 보낸 대진 검증
     */
    const normalizedMatches = submittedMatches.map((submittedMatch, index) => {
      if (!submittedMatch || typeof submittedMatch !== "object") {
        throw new BadRequestError(
          `${index + 1}번째 대진 정보가 올바르지 않습니다.`,
        );
      }

      const homeTeamId = String(submittedMatch.homeTeamId || "");

      const awayTeamId = String(submittedMatch.awayTeamId || "");

      const round = Number(submittedMatch.round || 0);
      const sortOrder = Number(submittedMatch.sortOrder || 0);

      if (!teamsById.has(homeTeamId) || !teamsById.has(awayTeamId)) {
        throw new BadRequestError(
          "현재 팀 편성에 포함되지 않은 팀이 있습니다.",
        );
      }

      if (homeTeamId === awayTeamId) {
        throw new BadRequestError("같은 팀끼리는 대결할 수 없습니다.");
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

      const pairKey = [homeTeamId, awayTeamId].sort().join(":");

      return {
        homeTeamId,
        awayTeamId,
        pairKey,
        round,
        sortOrder,
      };
    });

    /*
     * 6. 같은 팀 조합 중복 검사
     */
    const submittedPairKeys = normalizedMatches.map((match) => match.pairKey);

    if (new Set(submittedPairKeys).size !== submittedPairKeys.length) {
      throw new BadRequestError("동일한 팀 조합이 중복되어 있습니다.");
    }

    /*
     * 현재 팀으로 나올 수 있는 모든 조합을 생성합니다.
     */
    const expectedPairKeys = [];

    for (let leftIndex = 0; leftIndex < teamRecords.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < teamRecords.length;
        rightIndex += 1
      ) {
        expectedPairKeys.push(
          [teamRecords[leftIndex].id, teamRecords[rightIndex].id]
            .sort()
            .join(":"),
        );
      }
    }

    if (
      expectedPairKeys.some((pairKey) => !submittedPairKeys.includes(pairKey))
    ) {
      throw new BadRequestError("일부 팀 대진이 누락되었습니다.");
    }

    /*
     * 7. 전체 경기 순서 검사
     */
    const sortedOrders = normalizedMatches
      .map((match) => match.sortOrder)
      .sort((left, right) => left - right);

    const hasInvalidOrder = sortedOrders.some(
      (order, index) => order !== index + 1,
    );

    if (hasInvalidOrder) {
      throw new BadRequestError("대진 순서는 1부터 연속되어야 합니다.");
    }

    /*
     * 8. 라운드별 동일 팀 중복 출전 검사
     */
    const teamsByRound = new Map();

    normalizedMatches.forEach((match) => {
      const roundTeamIds = teamsByRound.get(match.round) || new Set();

      if (
        roundTeamIds.has(match.homeTeamId) ||
        roundTeamIds.has(match.awayTeamId)
      ) {
        throw new BadRequestError(
          `${match.round}라운드에서 한 팀이 두 번 이상 경기합니다.`,
        );
      }

      roundTeamIds.add(match.homeTeamId);
      roundTeamIds.add(match.awayTeamId);

      teamsByRound.set(match.round, roundTeamIds);
    });

    const roundNumbers = [
      ...new Set(normalizedMatches.map((match) => match.round)),
    ].sort((left, right) => left - right);

    if (roundNumbers.some((roundNumber, index) => roundNumber !== index + 1)) {
      throw new BadRequestError("라운드는 1부터 연속되어야 합니다.");
    }

    /*
     * 9. 기존 대진 및 버전 확인
     */
    const existingMatches = dao.findRecordsByFilter(
      "team_matches",
      "formation = {:formationId}",
      "sort_order",
      500,
      0,
      {
        formationId: formation.id,
      },
    );

    const currentScheduleVersion =
      existingMatches.length > 0 ? existingMatches[0].getInt("version") : 0;

    if (
      existingMatches.some(
        (match) => match.getInt("version") !== currentScheduleVersion,
      )
    ) {
      throw new BadRequestError("저장된 대진 버전이 일치하지 않습니다.");
    }

    if (currentScheduleVersion !== expectedScheduleVersion) {
      throw new ApiError(
        409,
        "다른 사용자가 먼저 대진을 변경했습니다. 최신 대진을 다시 불러와 주세요.",
      );
    }

    /*
     * 경기 시작 이후에는 대진 전체 재생성을 막습니다.
     */
    const hasStartedMatch = existingMatches.some((match) =>
      ["in_progress", "completed"].includes(match.getString("status")),
    );

    if (hasStartedMatch) {
      throw new BadRequestError(
        "이미 시작했거나 완료된 경기가 있어 대진을 재생성할 수 없습니다.",
      );
    }

    const nextScheduleVersion = currentScheduleVersion + 1;

    /*
     * 10. 전체 대진 transaction 저장
     */
    $app.dao().runInTransaction((transactionDao) => {
      const teamMatchesCollection =
        transactionDao.findCollectionByNameOrId("team_matches");

      const matchGamesCollection =
        transactionDao.findCollectionByNameOrId("match_games");

      const lineupsCollection =
        transactionDao.findCollectionByNameOrId("team_match_lineups");

      /*
       * team_match를 삭제하면 cascadeDelete 설정에 의해
       * 기존 match_games, lineups, players도 함께 삭제됩니다.
       */
      const matchesToDelete = transactionDao.findRecordsByFilter(
        "team_matches",
        "formation = {:formationId}",
        "",
        500,
        0,
        {
          formationId: formation.id,
        },
      );

      matchesToDelete.forEach((match) => {
        transactionDao.deleteRecord(match);
      });

      normalizedMatches
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .forEach((matchInput) => {
          const teamMatch = new Record(teamMatchesCollection);

          teamMatch.set("event", eventId);
          teamMatch.set("game_setting", gameSettingId);
          teamMatch.set("formation", formation.id);

          teamMatch.set("home_team", matchInput.homeTeamId);

          teamMatch.set("away_team", matchInput.awayTeamId);

          teamMatch.set("pair_key", matchInput.pairKey);
          teamMatch.set("round", matchInput.round);
          teamMatch.set("sort_order", matchInput.sortOrder);

          teamMatch.set("format_snapshot", formatSnapshotJson);

          teamMatch.set("status", "scheduled");
          teamMatch.set("version", nextScheduleVersion);

          transactionDao.saveRecord(teamMatch);

          /*
           * 설정된 단식·복식 순서대로 세부 경기 생성
           */
          formatSnapshot.forEach((format) => {
            const matchGame = new Record(matchGamesCollection);

            matchGame.set("team_match", teamMatch.id);
            matchGame.set("sequence", format.sequence);
            matchGame.set("match_type", format.matchType);
            matchGame.set("best_of", format.bestOf);
            matchGame.set("counts_for_ranking", format.countsForRanking);
            matchGame.set("status", "scheduled");
            matchGame.set("version", 1);

            transactionDao.saveRecord(matchGame);
          });

          /*
           * 홈팀과 원정팀은 각자 독립된 라인업을 작성합니다.
           */
          [matchInput.homeTeamId, matchInput.awayTeamId].forEach((teamId) => {
            const lineup = new Record(lineupsCollection);

            lineup.set("team_match", teamMatch.id);
            lineup.set("team", teamId);
            lineup.set("status", "draft");
            lineup.set("confirmed_by", "");
            lineup.set("confirmed_at", "");
            lineup.set("version", 1);

            transactionDao.saveRecord(lineup);
          });
        });
    });

    return context.json(200, {
      formationId: formation.id,

      scheduleVersion: nextScheduleVersion,

      totalRoundCount: roundNumbers.length,
      totalMatchCount: normalizedMatches.length,

      matchFormatCount: formatSnapshot.length,
    });
  },
  require(`${__hooks}/admin_auth.js`).requireActiveAdmin,
);

/*
 * 저장된 팀 대진 조회
 *
 * GET /api/somoim/admin/game-settings/:gameSettingId/team-schedule
 */
routerAdd(
  "GET",
  "/api/somoim/admin/game-settings/:gameSettingId/team-schedule",
  (context) => {
    const gameSettingId = context.pathParam("gameSettingId");

    const dao = $app.dao();

    const gameSetting = dao.findRecordById(
      "event_game_settings",
      gameSettingId,
    );

    if (gameSetting.getString("competition_type") !== "team_league") {
      throw new BadRequestError(
        "팀 리그 설정에서만 팀 대진을 조회할 수 있습니다.",
      );
    }

    const eventId = gameSetting.getString("event");

    const formatRecords = dao.findRecordsByFilter(
      "event_match_formats",
      "game_setting = {:gameSettingId}",
      "sequence",
      100,
      0,
      {
        gameSettingId,
      },
    );

    const formats = formatRecords.map((format) => ({
      sequence: format.getInt("sequence"),
      matchType: format.getString("match_type"),
      bestOf: format.getInt("best_of"),
      countsForRanking: format.getBool("counts_for_ranking"),
    }));

    let formation = null;

    try {
      formation = dao.findFirstRecordByFilter(
        "team_formations",
        "game_setting = {:gameSettingId}",
        {
          gameSettingId,
        },
      );
    } catch {
      return context.json(200, {
        eventId,
        gameSettingId,

        formation: null,
        teams: [],
        formats,

        scheduleVersion: 0,
        totalRoundCount: 0,
        totalMatchCount: 0,

        canRegenerate: false,
        rounds: [],
      });
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

    const teams = teamRecords.map((team) => ({
      id: team.id,
      name: team.getString("name"),
      sortOrder: team.getInt("sort_order"),
    }));

    const teamsById = new Map(teams.map((team) => [team.id, team]));

    const matchRecords = dao.findRecordsByFilter(
      "team_matches",
      "formation = {:formationId}",
      "sort_order",
      500,
      0,
      {
        formationId: formation.id,
      },
    );

    const matches = matchRecords.map((teamMatch) => {
      const matchGames = dao.findRecordsByFilter(
        "match_games",
        "team_match = {:teamMatchId}",
        "sequence",
        100,
        0,
        {
          teamMatchId: teamMatch.id,
        },
      );

      const lineups = dao.findRecordsByFilter(
        "team_match_lineups",
        "team_match = {:teamMatchId}",
        "",
        2,
        0,
        {
          teamMatchId: teamMatch.id,
        },
      );

      const homeTeamId = teamMatch.getString("home_team");
      const awayTeamId = teamMatch.getString("away_team");

      const homeLineup = lineups.find(
        (lineup) => lineup.getString("team") === homeTeamId,
      );

      const awayLineup = lineups.find(
        (lineup) => lineup.getString("team") === awayTeamId,
      );

      return {
        id: teamMatch.id,

        pairKey: teamMatch.getString("pair_key"),

        round: teamMatch.getInt("round"),
        sortOrder: teamMatch.getInt("sort_order"),

        status: teamMatch.getString("status"),
        version: teamMatch.getInt("version"),

        homeTeam: teamsById.get(homeTeamId) || {
          id: homeTeamId,
          name: "삭제된 팀",
          sortOrder: 0,
        },

        awayTeam: teamsById.get(awayTeamId) || {
          id: awayTeamId,
          name: "삭제된 팀",
          sortOrder: 0,
        },

        games: matchGames.map((game) => {
          const playerRecords = dao.findRecordsByFilter(
            "match_game_players",
            "match_game = {:matchGameId}",
            "position",
            10,
            0,
            {
              matchGameId: game.id,
            },
          );

          const serializePlayers = function (lineupRecord) {
            if (!lineupRecord) {
              return [];
            }

            return playerRecords
              .filter(
                (playerRecord) =>
                  playerRecord.getString("lineup") === lineupRecord.id,
              )
              .map((playerRecord) => {
                const participantRecord = dao.findRecordById(
                  "event_participants",
                  playerRecord.getString("participant"),
                );

                return {
                  participantId: participantRecord.id,
                  name: participantRecord.getString("display_name") || "참가자",
                  position: playerRecord.getInt("position"),
                };
              });
          };

          const submissionRecords = dao.findRecordsByFilter(
            "match_result_submissions",
            "match_game = {:matchGameId}",
            "",
            2,
            0,
            {
              matchGameId: game.id,
            },
          );

          return {
            id: game.id,
            sequence: game.getInt("sequence"),
            matchType: game.getString("match_type"),
            bestOf: game.getInt("best_of"),
            countsForRanking: game.getBool("counts_for_ranking"),
            status: game.getString("status"),

            resultStatus: game.getString("result_status") || "pending",

            homeScore: game.getInt("home_score"),
            awayScore: game.getInt("away_score"),

            winnerSide: game.getString("winner_side"),

            resultConfirmedAt: game.getString("result_confirmed_at"),

            submissionCount: submissionRecords.length,

            homePlayers: serializePlayers(homeLineup),
            awayPlayers: serializePlayers(awayLineup),
          };
        }),

        homeLineupStatus: homeLineup ? homeLineup.getString("status") : "draft",

        awayLineupStatus: awayLineup ? awayLineup.getString("status") : "draft",
      };
    });

    const roundNumbers = [...new Set(matches.map((match) => match.round))].sort(
      (left, right) => left - right,
    );

    const rounds = roundNumbers.map((roundNumber) => {
      const roundMatches = matches.filter(
        (match) => match.round === roundNumber,
      );

      const playingTeamIds = new Set(
        roundMatches.flatMap((match) => [match.homeTeam.id, match.awayTeam.id]),
      );

      const byeTeam =
        teams.length % 2 !== 0
          ? teams.find((team) => !playingTeamIds.has(team.id)) || null
          : null;

      return {
        round: roundNumber,
        matches: roundMatches,
        byeTeam,
      };
    });

    const scheduleVersion =
      matchRecords.length > 0 ? matchRecords[0].getInt("version") : 0;

    const canRegenerate =
      formation.getString("status") === "confirmed" &&
      matchRecords.every((match) =>
        ["scheduled", "ready"].includes(match.getString("status")),
      );

    return context.json(200, {
      eventId,
      gameSettingId,

      formation: {
        id: formation.id,
        status: formation.getString("status"),
        version: formation.getInt("version"),
      },

      teams,
      formats,

      scheduleVersion,
      totalRoundCount: rounds.length,
      totalMatchCount: matches.length,

      canRegenerate,
      rounds,
    });
  },
  require(`${__hooks}/admin_auth.js`).requireActiveAdmin,
);
