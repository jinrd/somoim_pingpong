/// <reference path="../pb_data/types.d.ts" />

const adminMiddleware = require(`${__hooks}/admin_auth.js`).requireActiveAdmin;

/*
 * 참가 신청 최종 마감
 */
routerAdd(
  "POST",
  "/api/somoim/admin/events/:eventId/participation/close",
  (context) => {
    const eventId = context.pathParam("eventId");
    /** @type {any} */
    const requestData = new DynamicModel({
      expectedVersion: 0,
    });

    context.bind(requestData);

    const expectedVersion = Number(requestData.expectedVersion || 0);
    let response = null;

    $app.dao().runInTransaction((transactionDao) => {
      const workflow = require(`${__hooks}/event_workflow_service.js`);
      const eventRecord = transactionDao.findRecordById("events", eventId);

      workflow.assertRegistrationOpen(eventRecord);
      workflow.assertNoUndecidedParticipants(transactionDao, eventId);

      if (eventRecord.getInt("version") !== expectedVersion) {
        throw new ApiError(
          409,
          "다른 운영진이 먼저 회차를 변경했습니다. 최신 정보를 다시 불러와 주세요.",
        );
      }

      if (workflow.findGameSetting(transactionDao, eventId)) {
        throw new BadRequestError(
          "신청 마감 전에 생성된 게임 설정이 있습니다. 기존 설정을 정리한 후 다시 시도해 주세요.",
        );
      }

      const closedAt = new Date().toISOString();

      eventRecord.set("participation_status", "closed");
      eventRecord.set("participation_closed_at", closedAt);
      eventRecord.set("version", eventRecord.getInt("version") + 1);

      transactionDao.saveRecord(eventRecord);

      response = {
        participation_status: "closed",
        participation_closed_at: closedAt,
        version: eventRecord.getInt("version"),
      };
    });

    return context.json(200, response);
  },
  adminMiddleware,
);

/*
 * 일반 Record API로 마감 상태를 되돌리는 우회를 막습니다.
 * 내부 workflow route의 DAO 저장은 request hook 대상이 아닙니다.
 */
onRecordBeforeCreateRequest((event) => {
  if (event.record.getString("participation_status") !== "open") {
    throw new BadRequestError("새 회차의 참가 신청 상태는 접수 중이어야 합니다.");
  }
}, "events");

onRecordBeforeUpdateRequest((event) => {
  const originalRecord = $app.dao().findRecordById("events", event.record.id);

  if (
    originalRecord.getString("participation_status") !==
      event.record.getString("participation_status") ||
    originalRecord.getString("participation_closed_at") !==
      event.record.getString("participation_closed_at")
  ) {
    throw new BadRequestError(
      "참가 신청 상태는 참석자 관리 화면의 최종 마감 기능으로만 변경할 수 있습니다.",
    );
  }
}, "events");

/*
 * 운영진의 참가 상태 변경
 *
 * 마감 후 상태를 바꿀 때 게임 구성이 존재하면 같은 트랜잭션에서
 * 게임 설정부터 대진·라인업까지 전체 초기화합니다.
 */
routerAdd(
  "PATCH",
  "/api/somoim/admin/participants/:participantId/game-status",
  (context) => {
    const participantId = context.pathParam("participantId");
    /** @type {any} */
    const requestData = new DynamicModel({
      gameParticipationStatus: "",
      expectedVersion: 0,
      confirmReset: false,
    });

    context.bind(requestData);

    const nextStatus = String(requestData.gameParticipationStatus || "");
    const expectedVersion = Number(requestData.expectedVersion || 0);
    const confirmReset = Boolean(requestData.confirmReset);

    if (!["undecided", "playing", "not_playing"].includes(nextStatus)) {
      throw new BadRequestError("게임 참가 상태를 확인해 주세요.");
    }

    let response = null;

    $app.dao().runInTransaction((transactionDao) => {
      const workflow = require(`${__hooks}/event_workflow_service.js`);
      const participantRecord = transactionDao.findRecordById(
        "event_participants",
        participantId,
      );
      const eventId = participantRecord.getString("event");
      const eventRecord = transactionDao.findRecordById("events", eventId);
      const isClosed =
        eventRecord.getString("participation_status") === "closed";

      if (participantRecord.getInt("version") !== expectedVersion) {
        throw new ApiError(
          409,
          "다른 운영진이 먼저 참석자 정보를 변경했습니다. 최신 정보를 다시 불러와 주세요.",
        );
      }

      if (isClosed && nextStatus === "undecided") {
        throw new BadRequestError(
          "참가 신청 마감 후에는 참가 상태를 미정으로 변경할 수 없습니다.",
        );
      }

      if (
        participantRecord.getString("participant_type") === "member" &&
        nextStatus === "playing"
      ) {
        const integrity = require(
          `${__hooks}/event_participant_integrity.js`,
        );

        integrity.ensureActiveParticipantMember(participantRecord);
      }

      const currentStatus = participantRecord.getString(
        "game_participation_status",
      );

      if (currentStatus === nextStatus) {
        response = {
          participant: workflow.toParticipantDto(participantRecord),
          gameConfigurationReset: false,
        };
        return;
      }

      workflow.assertSetupEditable(transactionDao, eventId);

      const gameSetting = workflow.findGameSetting(transactionDao, eventId);

      if (isClosed && gameSetting && !confirmReset) {
        throw new ApiError(
          409,
          "참가 상태를 변경하면 저장된 게임 설정, 팀 편성, 대진표와 라인업이 모두 초기화됩니다.",
          {
            resetRequired: true,
          },
        );
      }

      const gameConfigurationReset =
        isClosed && gameSetting
          ? workflow.deleteGameConfiguration(transactionDao, eventId)
          : false;

      participantRecord.set("game_participation_status", nextStatus);
      participantRecord.set(
        "participation_responded_at",
        nextStatus === "undecided" ? "" : new Date().toISOString(),
      );
      participantRecord.set(
        "version",
        participantRecord.getInt("version") + 1,
      );

      transactionDao.saveRecord(participantRecord);

      response = {
        participant: workflow.toParticipantDto(participantRecord),
        gameConfigurationReset,
      };
    });

    return context.json(200, response);
  },
  adminMiddleware,
);

/*
 * 게임 설정 초안 저장
 */
routerAdd(
  "PUT",
  "/api/somoim/admin/events/:eventId/game-setting",
  (context) => {
    const eventId = context.pathParam("eventId");
    /** @type {any} */
    const requestData = new DynamicModel({
      competitionType: "",
      teamSize: 0,
      autoTeamBalance: false,
      individualBestOf: 0,
      individualCountsForRanking: false,
      expectedVersion: 0,
    });

    context.bind(requestData);

    const competitionType = String(requestData.competitionType || "");
    const teamSize = Number(requestData.teamSize || 0);
    const individualBestOf = Number(requestData.individualBestOf || 0);
    const expectedVersion = Number(requestData.expectedVersion || 0);

    if (!["team_league", "individual_singles"].includes(competitionType)) {
      throw new BadRequestError("게임 운영 방식을 확인해 주세요.");
    }

    if (
      competitionType === "team_league" &&
      (!Number.isInteger(teamSize) || teamSize < 1)
    ) {
      throw new BadRequestError("팀당 인원은 1 이상의 정수여야 합니다.");
    }

    if (
      !Number.isInteger(individualBestOf) ||
      individualBestOf < 1 ||
      individualBestOf % 2 === 0
    ) {
      throw new BadRequestError("개인 단식 경기 판수는 홀수여야 합니다.");
    }

    let savedSetting = null;

    $app.dao().runInTransaction((transactionDao) => {
      const workflow = require(`${__hooks}/event_workflow_service.js`);
      const eventRecord = transactionDao.findRecordById("events", eventId);

      workflow.assertRegistrationClosed(eventRecord);
      workflow.assertNoUndecidedParticipants(transactionDao, eventId);
      workflow.assertSetupEditable(transactionDao, eventId);

      const currentSetting = workflow.findGameSetting(transactionDao, eventId);

      if (
        (currentSetting && currentSetting.getInt("version") !== expectedVersion) ||
        (!currentSetting && expectedVersion !== 0)
      ) {
        throw new ApiError(
          409,
          "다른 운영진이 먼저 게임 설정을 변경했습니다. 최신 정보를 다시 불러와 주세요.",
        );
      }

      if (
        currentSetting &&
        currentSetting.getString("status") === "confirmed"
      ) {
        throw new BadRequestError(
          "확정된 게임 설정입니다. 먼저 '게임 설정 수정'을 눌러 기존 경기 구성을 초기화해 주세요.",
        );
      }

      let editableSetting = currentSetting;

      /*
       * 이전 버전에서 초안 상태인데도 편성/대진이 남은 데이터가 있다면
       * 부분 수정하지 않고 전체 초기화한 새 초안으로 복구합니다.
       */
      if (
        currentSetting &&
        workflow.hasDownstreamConfiguration(
          transactionDao,
          currentSetting.id,
        )
      ) {
        transactionDao.deleteRecord(currentSetting);
        editableSetting = null;
      }

      const settingsCollection =
        transactionDao.findCollectionByNameOrId("event_game_settings");
      const settingRecord =
        editableSetting || new Record(settingsCollection);

      if (editableSetting && competitionType === "individual_singles") {
        const obsoleteFormats = transactionDao.findRecordsByFilter(
          "event_match_formats",
          "game_setting = {:gameSettingId}",
          "",
          200,
          0,
          { gameSettingId: editableSetting.id },
        );

        obsoleteFormats.forEach((formatRecord) => {
          transactionDao.deleteRecord(formatRecord);
        });
      }

      settingRecord.set("event", eventId);
      settingRecord.set("competition_type", competitionType);
      settingRecord.set(
        "team_size",
        competitionType === "team_league" ? teamSize : 0,
      );
      settingRecord.set(
        "auto_team_balance",
        competitionType === "team_league"
          ? Boolean(requestData.autoTeamBalance)
          : false,
      );
      settingRecord.set("individual_best_of", individualBestOf);
      settingRecord.set(
        "individual_counts_for_ranking",
        Boolean(requestData.individualCountsForRanking),
      );
      settingRecord.set("status", "draft");
      settingRecord.set(
        "version",
        editableSetting ? editableSetting.getInt("version") + 1 : 1,
      );

      transactionDao.saveRecord(settingRecord);
      savedSetting = workflow.toGameSettingDto(settingRecord);
    });

    return context.json(200, savedSetting);
  },
  adminMiddleware,
);

/*
 * 게임 설정 최종 확정
 */
routerAdd(
  "POST",
  "/api/somoim/admin/game-settings/:gameSettingId/confirm",
  (context) => {
    const gameSettingId = context.pathParam("gameSettingId");
    /** @type {any} */
    const requestData = new DynamicModel({
      expectedVersion: 0,
    });

    context.bind(requestData);

    const expectedVersion = Number(requestData.expectedVersion || 0);
    let savedSetting = null;

    $app.dao().runInTransaction((transactionDao) => {
      const workflow = require(`${__hooks}/event_workflow_service.js`);
      const settingRecord = transactionDao.findRecordById(
        "event_game_settings",
        gameSettingId,
      );
      const eventId = settingRecord.getString("event");
      const eventRecord = transactionDao.findRecordById("events", eventId);

      workflow.assertRegistrationClosed(eventRecord);
      workflow.assertNoUndecidedParticipants(transactionDao, eventId);
      workflow.assertSetupEditable(transactionDao, eventId);

      if (settingRecord.getInt("version") !== expectedVersion) {
        throw new ApiError(
          409,
          "다른 운영진이 먼저 게임 설정을 변경했습니다. 최신 정보를 다시 불러와 주세요.",
        );
      }

      if (settingRecord.getString("status") !== "draft") {
        throw new BadRequestError("이미 최종 확정된 게임 설정입니다.");
      }

      if (settingRecord.getString("competition_type") === "team_league") {
        const formats = transactionDao.findRecordsByFilter(
          "event_match_formats",
          "game_setting = {:gameSettingId}",
          "sequence",
          200,
          0,
          { gameSettingId },
        );

        if (formats.length === 0) {
          throw new BadRequestError(
            "팀 대결 세부 경기를 한 개 이상 저장한 후 확정해 주세요.",
          );
        }

        if (
          formats.some(
            (formatRecord) =>
              formatRecord.getString("match_type") === "doubles",
          ) &&
          settingRecord.getInt("team_size") < 2
        ) {
          throw new BadRequestError(
            "복식 경기가 있으므로 팀당 인원은 최소 2명이어야 합니다.",
          );
        }
      }

      settingRecord.set("status", "confirmed");
      settingRecord.set("version", settingRecord.getInt("version") + 1);
      transactionDao.saveRecord(settingRecord);

      savedSetting = workflow.toGameSettingDto(settingRecord);
    });

    return context.json(200, savedSetting);
  },
  adminMiddleware,
);

/*
 * 확정된 게임 설정 수정 시작
 *
 * 기존 설정과 하위 데이터 전체를 지운 뒤 같은 기본값의 새 초안을 만듭니다.
 */
routerAdd(
  "POST",
  "/api/somoim/admin/game-settings/:gameSettingId/unlock",
  (context) => {
    const gameSettingId = context.pathParam("gameSettingId");
    /** @type {any} */
    const requestData = new DynamicModel({
      expectedVersion: 0,
    });

    context.bind(requestData);

    const expectedVersion = Number(requestData.expectedVersion || 0);
    let savedSetting = null;

    $app.dao().runInTransaction((transactionDao) => {
      const workflow = require(`${__hooks}/event_workflow_service.js`);
      const currentSetting = transactionDao.findRecordById(
        "event_game_settings",
        gameSettingId,
      );
      const eventId = currentSetting.getString("event");
      const eventRecord = transactionDao.findRecordById("events", eventId);

      workflow.assertRegistrationClosed(eventRecord);
      workflow.assertNoUndecidedParticipants(transactionDao, eventId);
      workflow.assertSetupEditable(transactionDao, eventId);

      if (currentSetting.getInt("version") !== expectedVersion) {
        throw new ApiError(
          409,
          "다른 운영진이 먼저 게임 설정을 변경했습니다. 최신 정보를 다시 불러와 주세요.",
        );
      }

      if (currentSetting.getString("status") !== "confirmed") {
        throw new BadRequestError("확정된 게임 설정만 수정할 수 있습니다.");
      }

      const snapshot = {
        competitionType: currentSetting.getString("competition_type"),
        teamSize: currentSetting.getInt("team_size"),
        autoTeamBalance: currentSetting.getBool("auto_team_balance"),
        individualBestOf: currentSetting.getInt("individual_best_of"),
        individualCountsForRanking: currentSetting.getBool(
          "individual_counts_for_ranking",
        ),
      };

      transactionDao.deleteRecord(currentSetting);

      const settingsCollection =
        transactionDao.findCollectionByNameOrId("event_game_settings");
      const draftSetting = new Record(settingsCollection);

      draftSetting.set("event", eventId);
      draftSetting.set("competition_type", snapshot.competitionType);
      draftSetting.set("team_size", snapshot.teamSize);
      draftSetting.set("auto_team_balance", snapshot.autoTeamBalance);
      draftSetting.set("individual_best_of", snapshot.individualBestOf);
      draftSetting.set(
        "individual_counts_for_ranking",
        snapshot.individualCountsForRanking,
      );
      draftSetting.set("status", "draft");
      draftSetting.set("version", 1);

      transactionDao.saveRecord(draftSetting);
      savedSetting = workflow.toGameSettingDto(draftSetting);
    });

    return context.json(200, savedSetting);
  },
  adminMiddleware,
);

/*
 * 확정된 팀 편성 수정 시작: 대진 및 라인업을 초기화하고 편성을 초안으로 전환
 */
routerAdd(
  "POST",
  "/api/somoim/admin/game-settings/:gameSettingId/team-formation/unlock",
  (context) => {
    const gameSettingId = context.pathParam("gameSettingId");
    /** @type {any} */
    const requestData = new DynamicModel({
      expectedVersion: 0,
    });

    context.bind(requestData);

    const expectedVersion = Number(requestData.expectedVersion || 0);
    let response = null;

    $app.dao().runInTransaction((transactionDao) => {
      const workflow = require(`${__hooks}/event_workflow_service.js`);
      const service = require(`${__hooks}/team_formations_service.js`);
      const settingRecord = transactionDao.findRecordById(
        "event_game_settings",
        gameSettingId,
      );
      const eventId = settingRecord.getString("event");
      const formationRecord = service.findFormation(
        transactionDao,
        gameSettingId,
      );

      if (!formationRecord) {
        throw new BadRequestError("수정할 팀 편성을 찾을 수 없습니다.");
      }

      workflow.assertSetupEditable(transactionDao, eventId);

      if (formationRecord.getInt("version") !== expectedVersion) {
        throw new ApiError(
          409,
          "다른 운영진이 먼저 팀 편성을 변경했습니다. 최신 편성을 다시 불러와 주세요.",
        );
      }

      if (formationRecord.getString("status") !== "confirmed") {
        throw new BadRequestError("확정된 팀 편성만 수정할 수 있습니다.");
      }

      const schedulesReset = workflow.deleteTeamSchedules(
        transactionDao,
        formationRecord.id,
      );

      formationRecord.set("status", "draft");
      formationRecord.set("version", formationRecord.getInt("version") + 1);
      transactionDao.saveRecord(formationRecord);

      response = {
        formationId: formationRecord.id,
        status: "draft",
        version: formationRecord.getInt("version"),
        schedulesReset,
      };
    });

    return context.json(200, response);
  },
  adminMiddleware,
);
