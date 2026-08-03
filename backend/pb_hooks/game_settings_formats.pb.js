/// <reference path="../pb_data/types.d.ts" />

/**
 * 관리자 전용: 팀 대결 세부 경기 전체 저장
 *
 * PUT /api/somoim/admin/game-settings/:gameSettingId/match-formats
 *
 * body:
 * {
 *   "formats": [
 *     {
 *       "id": "기존 레코드 ID 또는 빈 문자열",
 *       "matchType": "singles",
 *       "bestOf": 3,
 *       "countsForRanking": false
 *     }
 *   ]
 * }
 *
 * 배열에 없는 기존 레코드는 삭제하고 배열 순서대로 sequence를 다시 부여합니다.
 */
routerAdd(
  "PUT",
  "/api/somoim/admin/game-settings/:gameSettingId/match-formats",
  (context) => {
    const gameSettingId = context.pathParam("gameSettingId");
    const requestData = new DynamicModel({ formats: [] });

    context.bind(requestData);

    const formats = requestData.formats;

    if (!Array.isArray(formats)) {
      throw new BadRequestError("세부 경기 목록 형식이 올바르지 않습니다.");
    }

    if (![1, 3, 5].includes(formats.length)) {
      throw new BadRequestError(
        "팀 대결 세부 경기 수는 1개, 3개, 5개 중에서 선택해 주세요.",
      );
    }

    formats.forEach((format, index) => {
      if (!format || typeof format !== "object") {
        throw new BadRequestError(
          `${index + 1}번째 경기 형식이 올바르지 않습니다.`,
        );
      }

      if (format.matchType !== "singles" && format.matchType !== "doubles") {
        throw new BadRequestError(
          `${index + 1}번째 경기 방식을 확인해 주세요.`,
        );
      }

      if (
        !Number.isInteger(format.bestOf) ||
        format.bestOf < 1 ||
        format.bestOf % 2 === 0
      ) {
        throw new BadRequestError(
          `${index + 1}번째 경기 판수는 1 이상의 홀수여야 합니다.`,
        );
      }

      if (typeof format.countsForRanking !== "boolean") {
        throw new BadRequestError(
          `${index + 1}번째 경기의 부수 승강 반영 여부를 확인해 주세요.`,
        );
      }
    });

    const submittedIds = formats
      .map((format) => String(format.id || ""))
      .filter(Boolean);

    if (new Set(submittedIds).size !== submittedIds.length) {
      throw new BadRequestError("중복된 세부 경기가 포함되어 있습니다.");
    }

    const gameSettingRecord = $app
      .dao()
      .findRecordById("event_game_settings", gameSettingId);
    const eventId = gameSettingRecord.getString("event");
    const workflow = require(`${__hooks}/event_workflow_service.js`);
    const eventRecord = $app.dao().findRecordById("events", eventId);

    workflow.assertRegistrationClosed(eventRecord);
    workflow.assertSetupEditable($app.dao(), eventId);

    if (gameSettingRecord.getString("status") !== "draft") {
      throw new BadRequestError(
        "확정된 게임 설정의 세부 경기는 변경할 수 없습니다. 먼저 '게임 설정 수정'을 눌러 주세요.",
      );
    }

    const currentRecords = $app
      .dao()
      .findRecordsByFilter(
        "event_match_formats",
        "game_setting = {:gameSettingId}",
        "sequence",
        200,
        0,
        { gameSettingId },
      );

    const currentIds = new Set(currentRecords.map((record) => record.id));

    if (submittedIds.some((id) => !currentIds.has(id))) {
      throw new BadRequestError(
        "다른 게임 설정의 경기가 포함되어 있습니다. 최신 목록을 다시 불러와 주세요.",
      );
    }

    const maximumSequence = currentRecords.reduce(
      (maximum, record) => Math.max(maximum, record.getInt("sequence")),
      0,
    );
    const temporarySequenceStart = maximumSequence + currentRecords.length + 1;

    $app.dao().runInTransaction((transactionDao) => {
      // 고유 인덱스 충돌 방지를 위해 기존 레코드를 먼저 임시 순번으로 이동합니다.
      currentRecords.forEach((currentRecord, index) => {
        const record = transactionDao.findRecordById(
          "event_match_formats",
          currentRecord.id,
        );

        record.set("sequence", temporarySequenceStart + index);
        transactionDao.saveRecord(record);
      });

      // 전송된 배열에서 빠진 레코드는 삭제로 간주합니다.
      currentRecords.forEach((currentRecord) => {
        if (!submittedIds.includes(currentRecord.id)) {
          const record = transactionDao.findRecordById(
            "event_match_formats",
            currentRecord.id,
          );

          transactionDao.deleteRecord(record);
        }
      });

      const collection = transactionDao.findCollectionByNameOrId(
        "event_match_formats",
      );

      formats.forEach((format, index) => {
        const id = String(format.id || "");
        const record = id
          ? transactionDao.findRecordById("event_match_formats", id)
          : new Record(collection);

        record.set("game_setting", gameSettingId);
        record.set("sequence", index + 1);
        record.set("match_type", format.matchType);
        record.set("best_of", format.bestOf);
        record.set("counts_for_ranking", format.countsForRanking);

        transactionDao.saveRecord(record);
      });
    });

    const savedRecords = $app
      .dao()
      .findRecordsByFilter(
        "event_match_formats",
        "game_setting = {:gameSettingId}",
        "sequence",
        200,
        0,
        { gameSettingId },
      );

    return context.json(
      200,
      savedRecords.map((record) => ({
        id: record.id,
        game_setting: record.getString("game_setting"),
        sequence: record.getInt("sequence"),
        match_type: record.getString("match_type"),
        best_of: record.getInt("best_of"),
        counts_for_ranking: record.getBool("counts_for_ranking"),
      })),
    );
  },
  require(`${__hooks}/admin_auth.js`).requireActiveAdmin,
);

["event_match_formats"].forEach((collectionName) => {
  onRecordBeforeCreateRequest(() => {
    throw new BadRequestError(
      "세부 경기는 게임 설정 화면의 전체 저장 기능을 사용해 주세요.",
    );
  }, collectionName);

  onRecordBeforeUpdateRequest(() => {
    throw new BadRequestError(
      "세부 경기는 게임 설정 화면의 전체 저장 기능을 사용해 주세요.",
    );
  }, collectionName);

  onRecordBeforeDeleteRequest(() => {
    throw new BadRequestError(
      "세부 경기는 게임 설정 화면의 전체 저장 기능을 사용해 주세요.",
    );
  }, collectionName);
});
