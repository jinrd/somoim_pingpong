// @ts-nocheck
/// <reference path="../pb_data/types.d.ts" />

/*
 * 준비 중인 회차 삭제
 *
 * events 컬렉션의 일반 Record 삭제는 막혀 있으므로,
 * 관리자 전용 API에서 상태와 버전을 검사한 뒤 삭제합니다.
 * 회차와 cascadeDelete로 연결된 참석자·게임 설정·대진·결과도 함께 삭제됩니다.
 */
routerAdd(
  "DELETE",
  "/api/somoim/admin/events/:eventId",
  (context) => {
    const eventId = context.pathParam("eventId");

    const requestData = new DynamicModel({
      expectedVersion: 0,
    });

    context.bind(requestData);

    const expectedVersion = Number(requestData.expectedVersion || 0);

    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      throw new BadRequestError("회차 버전 정보가 올바르지 않습니다.");
    }

    $app.dao().runInTransaction((transactionDao) => {
      let eventRecord;

      try {
        eventRecord = transactionDao.findRecordById("events", eventId);
      } catch {
        throw new NotFoundError("삭제할 회차를 찾을 수 없습니다.");
      }

      if (eventRecord.getInt("version") !== expectedVersion) {
        throw new ApiError(
          409,
          "다른 운영진이 회차를 먼저 변경했습니다. 최신 정보를 다시 불러와 주세요.",
        );
      }

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
