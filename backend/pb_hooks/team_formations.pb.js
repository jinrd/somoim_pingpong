/// <reference path="../pb_data/types.d.ts" />

/*
 * 전체 팀 편성 일괄 저장
 */
routerAdd(
  "PUT",
  "/api/somoim/admin/game-settings/:gameSettingId/team-formation",
  (context) => {
    const service = require(`${__hooks}/team_formations_service.js`);

    const config = require(`${__hooks}/config.js`);

    const gameSettingId = context.pathParam("gameSettingId");

    const requestData = new DynamicModel({
      method: "",
      status: "",
      expectedVersion: 0,
      teams: [],
    });

    context.bind(requestData);

    const method = String(requestData.method || "");
    const status = String(requestData.status || "");
    const expectedVersion = Number(requestData.expectedVersion || 0);
    const teams = requestData.teams;

    if (method !== "balanced" && method !== "random") {
      throw new BadRequestError("팀 편성 방식을 확인해 주세요.");
    }

    if (status !== "draft" && status !== "confirmed") {
      throw new BadRequestError("팀 편성 상태를 확인해 주세요.");
    }

    if (!Array.isArray(teams) || teams.length === 0) {
      throw new BadRequestError("저장할 팀 편성 정보가 없습니다.");
    }

    if (status === "confirmed" && teams.length < 2) {
      throw new BadRequestError(
        "팀 편성을 확정하려면 최소 두 팀이 필요합니다.",
      );
    }

    const gameSettingRecord = $app
      .dao()
      .findRecordById("event_game_settings", gameSettingId);

    if (gameSettingRecord.getString("competition_type") !== "team_league") {
      throw new BadRequestError("팀 리그 설정에서만 팀을 저장할 수 있습니다.");
    }

    const eventId = gameSettingRecord.getString("event");

    const normalizedTeams = teams.map((team, teamIndex) => {
      if (!team || typeof team !== "object") {
        throw new BadRequestError(
          `${teamIndex + 1}번째 팀 정보가 올바르지 않습니다.`,
        );
      }

      const id = String(team.id || "");
      const name = String(team.name || "").trim();
      const participantIds = team.participantIds;

      if (!name) {
        throw new BadRequestError(
          `${teamIndex + 1}번째 팀 이름을 입력해 주세요.`,
        );
      }

      if (name.length > 30) {
        throw new BadRequestError("팀 이름은 30자 이하로 입력해 주세요.");
      }

      if (!Array.isArray(participantIds) || participantIds.length === 0) {
        throw new BadRequestError(`${name}에 팀원이 없습니다.`);
      }

      const normalizedParticipantIds = participantIds.map((participantId) =>
        String(participantId || ""),
      );

      if (normalizedParticipantIds.some((participantId) => !participantId)) {
        throw new BadRequestError(`${name}의 참가자 정보가 올바르지 않습니다.`);
      }

      return {
        id,
        name,
        participantIds: normalizedParticipantIds,
      };
    });

    const normalizedNames = normalizedTeams.map((team) =>
      team.name.toLowerCase(),
    );

    if (new Set(normalizedNames).size !== normalizedNames.length) {
      throw new BadRequestError("중복된 팀 이름이 있습니다.");
    }

    const submittedTeamIds = normalizedTeams
      .map((team) => team.id)
      .filter(Boolean);

    if (new Set(submittedTeamIds).size !== submittedTeamIds.length) {
      throw new BadRequestError("중복된 팀 정보가 포함되어 있습니다.");
    }

    const submittedParticipantIds = normalizedTeams.flatMap(
      (team) => team.participantIds,
    );

    if (
      new Set(submittedParticipantIds).size !== submittedParticipantIds.length
    ) {
      throw new BadRequestError("한 참가자가 여러 팀에 포함되어 있습니다.");
    }

    const playingParticipantCandidates = $app
      .dao()
      .findRecordsByFilter(
        "event_participants",
        ["event = {:eventId}", "game_participation_status = {:status}"].join(
          " && ",
        ),
        "",
        500,
        0,
        {
          eventId,
          status: "playing",
        },
      );

    const playingParticipants = playingParticipantCandidates.filter(
      (participant) => {
        if (participant.getString("participant_type") !== "member") {
          return true;
        }

        try {
          const member = $app
            .dao()
            .findRecordById("members", participant.getString("member"));

          return member.getString("status") === "active";
        } catch {
          return false;
        }
      },
    );

    const playingParticipantIds = new Set(
      playingParticipants.map((participant) => participant.id),
    );

    if (
      submittedParticipantIds.length !== playingParticipants.length ||
      submittedParticipantIds.some(
        (participantId) => !playingParticipantIds.has(participantId),
      )
    ) {
      throw new ApiError(
        409,
        "게임 참가자 명단이 변경되었습니다. 최신 명단을 다시 불러와 주세요.",
      );
    }

    const participantsById = new Map(
      playingParticipants.map((participant) => [participant.id, participant]),
    );

    const hasDoublesFormat =
      $app
        .dao()
        .findRecordsByFilter(
          "event_match_formats",
          ["game_setting = {:gameSettingId}", "match_type = {:matchType}"].join(
            " && ",
          ),
          "",
          1,
          0,
          {
            gameSettingId,
            matchType: "doubles",
          },
        ).length > 0;

    if (
      status === "confirmed" &&
      hasDoublesFormat &&
      normalizedTeams.some((team) => team.participantIds.length < 2)
    ) {
      throw new BadRequestError(
        "복식 경기가 있으므로 모든 팀에 최소 2명이 필요합니다.",
      );
    }

    const currentFormation = service.findFormation($app.dao(), gameSettingId);

    if (
      currentFormation &&
      currentFormation.getInt("version") !== expectedVersion
    ) {
      throw new ApiError(
        409,
        "다른 운영진이 먼저 팀 편성을 변경했습니다. 최신 편성을 다시 불러와 주세요.",
      );
    }

    if (!currentFormation && expectedVersion !== 0) {
      throw new ApiError(
        409,
        "팀 편성 정보가 변경되었습니다. 최신 편성을 다시 불러와 주세요.",
      );
    }

    const currentTeams = currentFormation
      ? $app
          .dao()
          .findRecordsByFilter(
            "teams",
            "formation = {:formationId}",
            "sort_order",
            200,
            0,
            {
              formationId: currentFormation.id,
            },
          )
      : [];

    const currentTeamIds = new Set(currentTeams.map((team) => team.id));

    if (submittedTeamIds.some((teamId) => !currentTeamIds.has(teamId))) {
      throw new BadRequestError("다른 편성의 팀이 포함되어 있습니다.");
    }

    const qualityScore = service.calculateQualityScore(
      normalizedTeams,
      participantsById,
      config,
    );

    let savedFormationId = currentFormation ? currentFormation.id : "";

    $app.dao().runInTransaction((transactionDao) => {
      const formationCollection =
        transactionDao.findCollectionByNameOrId("team_formations");

      const formationRecord = currentFormation
        ? transactionDao.findRecordById("team_formations", currentFormation.id)
        : new Record(formationCollection);

      formationRecord.set("event", eventId);
      formationRecord.set("game_setting", gameSettingId);
      formationRecord.set("method", method);
      formationRecord.set("status", status);
      formationRecord.set("quality_score", qualityScore);
      formationRecord.set(
        "version",
        currentFormation ? currentFormation.getInt("version") + 1 : 1,
      );

      transactionDao.saveRecord(formationRecord);

      savedFormationId = formationRecord.id;

      const existingMembers = currentFormation
        ? transactionDao.findRecordsByFilter(
            "team_members",
            "formation = {:formationId}",
            "",
            1000,
            0,
            {
              formationId: currentFormation.id,
            },
          )
        : [];

      existingMembers.forEach((member) => {
        transactionDao.deleteRecord(member);
      });

      const temporarySortStart =
        currentTeams.length + normalizedTeams.length + 1;

      currentTeams.forEach((currentTeam, index) => {
        const teamRecord = transactionDao.findRecordById(
          "teams",
          currentTeam.id,
        );

        teamRecord.set("name", `__tmp_${currentTeam.id}`);
        teamRecord.set("sort_order", temporarySortStart + index);

        transactionDao.saveRecord(teamRecord);
      });

      currentTeams.forEach((currentTeam) => {
        if (!submittedTeamIds.includes(currentTeam.id)) {
          const teamRecord = transactionDao.findRecordById(
            "teams",
            currentTeam.id,
          );

          transactionDao.deleteRecord(teamRecord);
        }
      });

      const teamsCollection = transactionDao.findCollectionByNameOrId("teams");

      const teamMembersCollection =
        transactionDao.findCollectionByNameOrId("team_members");

      normalizedTeams.forEach((teamInput, teamIndex) => {
        const teamRecord = teamInput.id
          ? transactionDao.findRecordById("teams", teamInput.id)
          : new Record(teamsCollection);

        const totalRank = teamInput.participantIds.reduce(
          (total, participantId) =>
            total + participantsById.get(participantId).getInt("rank_snapshot"),
          0,
        );

        const averageRank = service.roundMetric(
          totalRank / teamInput.participantIds.length,
        );

        teamRecord.set("formation", savedFormationId);
        teamRecord.set("event", eventId);
        teamRecord.set("name", teamInput.name);
        teamRecord.set("sort_order", teamIndex + 1);
        teamRecord.set("average_rank", averageRank);
        teamRecord.set(
          "version",
          teamInput.id ? teamRecord.getInt("version") + 1 : 1,
        );

        transactionDao.saveRecord(teamRecord);

        teamInput.participantIds.forEach((participantId, memberIndex) => {
          const participant = participantsById.get(participantId);

          const memberRecord = new Record(teamMembersCollection);

          memberRecord.set("formation", savedFormationId);
          memberRecord.set("event", eventId);
          memberRecord.set("team", teamRecord.id);
          memberRecord.set("participant", participantId);
          memberRecord.set(
            "rank_snapshot",
            participant.getInt("rank_snapshot"),
          );
          memberRecord.set("sort_order", memberIndex + 1);

          transactionDao.saveRecord(memberRecord);
        });
      });
    });

    return context.json(
      200,
      service.buildContextResponse($app.dao(), gameSettingRecord),
    );
  },
  $apis.requireRecordAuth("users"),
);
/*
 * 게임 참가자 및 현재 팀 편성 조회
 */
routerAdd(
  "GET",
  "/api/somoim/admin/game-settings/:gameSettingId/team-formation",
  (context) => {
    const service = require(`${__hooks}/team_formations_service.js`);

    const gameSettingId = context.pathParam("gameSettingId");

    const gameSettingRecord = $app
      .dao()
      .findRecordById("event_game_settings", gameSettingId);

    if (gameSettingRecord.getString("competition_type") !== "team_league") {
      throw new BadRequestError("팀 리그 설정에서만 팀을 편성할 수 있습니다.");
    }

    return context.json(
      200,
      service.buildContextResponse($app.dao(), gameSettingRecord),
    );
  },
  $apis.requireRecordAuth("users"),
);
