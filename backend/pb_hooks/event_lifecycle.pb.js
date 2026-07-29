// @ts-nocheck
/// <reference path="../pb_data/types.d.ts" />

/*
 * 회차 기본 정보 수정, 종료 회차 보관, 준비 중인 회차 삭제
 *
 * events 컬렉션의 일반 Record 삭제는 막혀 있으므로,
 * 관리자 전용 API에서 상태와 버전을 검사한 뒤 변경합니다.
 * 회차와 cascadeDelete로 연결된 참석자·게임 설정·대진·결과도 함께 삭제됩니다.
 */
routerAdd(
  "PATCH",
  "/api/somoim/admin/events/:eventId",
  (context) => {
    const eventId = context.pathParam("eventId");

    const requestData = new DynamicModel({
      expectedVersion: 0,
      updateTitle: false,
      title: "",
      updateEventDate: false,
      eventDate: "",
      updateNotice: false,
      notice: "",
    });

    context.bind(requestData);

    const lifecycleService = require(
      `${__hooks}/event_lifecycle_service.js`,
    );
    let response = null;

    $app.dao().runInTransaction((transactionDao) => {
      let eventRecord;

      try {
        eventRecord = transactionDao.findRecordById("events", eventId);
      } catch (_) {
        throw new NotFoundError("수정할 회차를 찾을 수 없습니다.");
      }

      lifecycleService.assertExpectedVersion(
        eventRecord,
        Number(requestData.expectedVersion || 0),
      );

      if (eventRecord.getString("status") !== "draft") {
        throw new BadRequestError(
          "준비 중인 회차의 기본 정보만 수정할 수 있습니다.",
        );
      }

      let hasChanges = false;

      if (Boolean(requestData.updateTitle)) {
        const title = String(requestData.title || "").trim();

        if (!title || title.length > 150) {
          throw new BadRequestError(
            "회차 제목은 1자 이상 150자 이하로 입력해 주세요.",
          );
        }

        eventRecord.set("title", title);
        hasChanges = true;
      }

      if (Boolean(requestData.updateEventDate)) {
        const eventDate = String(requestData.eventDate || "").trim();
        const parsedEventDate = new Date(eventDate);

        if (!eventDate || Number.isNaN(parsedEventDate.getTime())) {
          throw new BadRequestError("올바른 회차 날짜를 입력해 주세요.");
        }

        eventRecord.set("event_date", parsedEventDate.toISOString());
        hasChanges = true;
      }

      if (Boolean(requestData.updateNotice)) {
        const notice = String(requestData.notice || "").trim();

        if (notice.length > 3000) {
          throw new BadRequestError(
            "공지사항은 3000자 이하로 입력해 주세요.",
          );
        }

        eventRecord.set("notice", notice);
        hasChanges = true;
      }

      if (!hasChanges) {
        throw new BadRequestError("수정할 회차 정보가 없습니다.");
      }

      eventRecord.set("version", eventRecord.getInt("version") + 1);
      transactionDao.saveRecord(eventRecord);
      response = lifecycleService.serializeEvent(eventRecord);
    });

    return context.json(200, response);
  },
  require(`${__hooks}/admin_auth.js`).requireActiveAdmin,
);

routerAdd(
  "POST",
  "/api/somoim/admin/events/:eventId/complete",
  (context) => {
    const eventId = context.pathParam("eventId");
    const requestData = new DynamicModel({
      expectedVersion: 0,
    });

    context.bind(requestData);

    const lifecycleService = require(
      `${__hooks}/event_lifecycle_service.js`,
    );
    let response = null;

    $app.dao().runInTransaction((transactionDao) => {
      let eventRecord;

      try {
        eventRecord = transactionDao.findRecordById("events", eventId);
      } catch (_) {
        throw new NotFoundError("종료할 회차를 찾을 수 없습니다.");
      }

      lifecycleService.assertExpectedVersion(
        eventRecord,
        Number(requestData.expectedVersion || 0),
      );

      if (eventRecord.getString("status") !== "active") {
        throw new BadRequestError(
          "진행 중인 회차만 강제로 종료할 수 있습니다.",
        );
      }

      let gameSetting;

      try {
        gameSetting = transactionDao.findFirstRecordByFilter(
          "event_game_settings",
          "event = {:eventId}",
          {
            eventId,
          },
        );
      } catch (_) {
        throw new BadRequestError("회차의 게임 설정을 찾을 수 없습니다.");
      }

      const competitionType = gameSetting.getString("competition_type");
      const matchCollection =
        competitionType === "team_league"
          ? "team_matches"
          : competitionType === "individual_singles"
            ? "individual_matches"
            : "";

      if (!matchCollection) {
        throw new BadRequestError("지원하지 않는 게임 운영 방식입니다.");
      }

      const matchRecords = transactionDao.findRecordsByFilter(
        matchCollection,
        "game_setting = {:gameSettingId}",
        "",
        500,
        0,
        {
          gameSettingId: gameSetting.id,
        },
      );

      if (matchRecords.length === 0) {
        throw new BadRequestError("종료할 저장 경기 정보가 없습니다.");
      }

      const cancelledAt = new Date().toISOString();

      matchRecords.forEach((matchRecord) => {
        const matchStatus = matchRecord.getString("status");

        if (matchStatus === "completed") {
          return;
        }

        if (competitionType === "team_league") {
          const gameRecords = transactionDao.findRecordsByFilter(
            "match_games",
            "team_match = {:teamMatchId}",
            "",
            100,
            0,
            {
              teamMatchId: matchRecord.id,
            },
          );

          gameRecords.forEach((gameRecord) => {
            const gameStatus = gameRecord.getString("status");

            if (gameStatus === "completed" || gameStatus === "cancelled") {
              return;
            }

            gameRecord.set("status", "cancelled");
            gameRecord.set("version", gameRecord.getInt("version") + 1);
            transactionDao.saveRecord(gameRecord);
          });
        }

        if (matchStatus === "cancelled") {
          return;
        }

        if (competitionType === "individual_singles") {
          matchRecord.set("table_number", 0);
        }

        matchRecord.set("status", "cancelled");
        matchRecord.set("completed_at", cancelledAt);
        matchRecord.set("version", matchRecord.getInt("version") + 1);
        transactionDao.saveRecord(matchRecord);
      });

      const eventStatusService = require(
        `${__hooks}/event_status_service.js`,
      );

      const syncedStatus = eventStatusService.syncEventStatus(
        transactionDao,
        eventId,
      );

      if (syncedStatus.status !== "completed") {
        throw new ApiError(500, "회차 종료 상태를 저장하지 못했습니다.");
      }

      const completedEvent = transactionDao.findRecordById(
        "events",
        eventId,
      );

      response = lifecycleService.serializeEvent(completedEvent);
    });

    return context.json(200, response);
  },
  require(`${__hooks}/admin_auth.js`).requireActiveAdmin,
);

routerAdd(
  "POST",
  "/api/somoim/admin/events/:eventId/archive",
  (context) => {
    const eventId = context.pathParam("eventId");
    const requestData = new DynamicModel({
      expectedVersion: 0,
    });

    context.bind(requestData);

    const lifecycleService = require(
      `${__hooks}/event_lifecycle_service.js`,
    );
    let response = null;

    $app.dao().runInTransaction((transactionDao) => {
      let eventRecord;

      try {
        eventRecord = transactionDao.findRecordById("events", eventId);
      } catch (_) {
        throw new NotFoundError("보관할 회차를 찾을 수 없습니다.");
      }

      lifecycleService.assertExpectedVersion(
        eventRecord,
        Number(requestData.expectedVersion || 0),
      );

      if (eventRecord.getString("status") !== "completed") {
        throw new BadRequestError("경기가 종료된 회차만 보관할 수 있습니다.");
      }

      eventRecord.set("status", "archived");
      eventRecord.set("public_access_enabled", false);
      eventRecord.set("public_token_hash", "");
      eventRecord.set("public_token_encrypted", "");
      eventRecord.set("public_expires_at", "");
      eventRecord.set("version", eventRecord.getInt("version") + 1);

      transactionDao.saveRecord(eventRecord);
      response = lifecycleService.serializeEvent(eventRecord);
    });

    return context.json(200, response);
  },
  require(`${__hooks}/admin_auth.js`).requireActiveAdmin,
);

routerAdd(
  "DELETE",
  "/api/somoim/admin/events/:eventId",
  (context) => {
    const eventId = context.pathParam("eventId");

    const requestData = new DynamicModel({
      expectedVersion: 0,
    });

    context.bind(requestData);

    const lifecycleService = require(
      `${__hooks}/event_lifecycle_service.js`,
    );
    const expectedVersion = Number(requestData.expectedVersion || 0);

    $app.dao().runInTransaction((transactionDao) => {
      let eventRecord;

      try {
        eventRecord = transactionDao.findRecordById("events", eventId);
      } catch {
        throw new NotFoundError("삭제할 회차를 찾을 수 없습니다.");
      }

      lifecycleService.assertExpectedVersion(eventRecord, expectedVersion);

      if (eventRecord.getString("status") !== "draft") {
        throw new BadRequestError(
          "준비 중인 회차만 삭제할 수 있습니다. 시작한 회차는 기록으로 보관해 주세요.",
        );
      }

      transactionDao.deleteRecord(eventRecord);
    });

    return context.noContent(204);
  },
  require(`${__hooks}/admin_auth.js`).requireActiveAdmin,
);
