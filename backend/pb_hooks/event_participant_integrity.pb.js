/// <reference path="../pb_data/types.d.ts" />

/*
 * 관리자 화면의 일반 Record API를 직접 호출해도
 * 비활동 회원을 회차에 새로 추가할 수 없게 합니다.
 */
onRecordBeforeCreateRequest((event) => {
  const workflow = require(`${__hooks}/event_workflow_service.js`);
  const eventRecord = $app
    .dao()
    .findRecordById("events", event.record.getString("event"));

  workflow.assertRegistrationOpen(eventRecord);

  const integrity = require(`${__hooks}/event_participant_integrity.js`);

  integrity.ensureActiveParticipantMember(event.record);
}, "event_participants");

/*
 * 이미 참석자 기록이 있는 회원도 비활동 상태라면
 * not_playing 이외의 참가 상태로 변경할 수 없습니다.
 *
 * not_playing 상태 저장은 비활동 전환 동기화에 필요하므로 허용합니다.
 */
onRecordBeforeUpdateRequest((event) => {
  const workflow = require(`${__hooks}/event_workflow_service.js`);
  const eventRecord = $app
    .dao()
    .findRecordById("events", event.record.getString("event"));

  if (eventRecord.getString("participation_status") === "closed") {
    throw new BadRequestError(
      "참가 신청이 마감되었습니다. 참가 상태는 참석자 관리 화면의 전용 변경 기능을 사용해 주세요.",
    );
  }

  if (event.record.getString("game_participation_status") === "not_playing") {
    return;
  }

  const integrity = require(`${__hooks}/event_participant_integrity.js`);

  integrity.ensureActiveParticipantMember(event.record);
}, "event_participants");

/*
 * 회원을 비활동으로 바꾸는 작업이 확정된 경기 구성을 조용히 깨뜨리지
 * 않도록, 관련 회차에 게임 설정이 있으면 먼저 참석자 관리에서
 * 게임 미참가로 변경하도록 안내합니다.
 */
onRecordBeforeUpdateRequest((event) => {
  const dao = $app.dao();
  const originalRecord = dao.findRecordById("members", event.record.id);

  if (
    originalRecord.getString("status") === "inactive" ||
    event.record.getString("status") !== "inactive"
  ) {
    return;
  }

  const workflow = require(`${__hooks}/event_workflow_service.js`);
  const participantRecords = dao.findRecordsByFilter(
    "event_participants",
    "member = {:memberId}",
    "",
    500,
    0,
    { memberId: event.record.id },
  );

  participantRecords.forEach((participantRecord) => {
    const eventId = participantRecord.getString("event");
    const somoimEvent = dao.findRecordById("events", eventId);

    if (!["draft", "active"].includes(somoimEvent.getString("status"))) {
      return;
    }

    workflow.assertSetupEditable(dao, eventId);

    if (workflow.findGameSetting(dao, eventId)) {
      throw new BadRequestError(
        `${somoimEvent.getString("title")} 회차에 게임 구성이 저장되어 있습니다. 해당 회차의 참석자 관리에서 먼저 게임 미참가로 변경해 주세요.`,
      );
    }
  });
}, "members");

/*
 * 회원을 비활동으로 변경하면 준비 중/진행 중 회차에서 즉시 제외합니다.
 * 참가자 레코드는 삭제하지 않아 과거 연결과 snapshot을 보존합니다.
 * 완료/보관 회차는 이미 확정된 기록이므로 변경하지 않습니다.
 */
onRecordAfterUpdateRequest((event) => {
  if (event.record.getString("status") !== "inactive") {
    return;
  }

  const dao = $app.dao();

  const participantRecords = dao.findRecordsByFilter(
    "event_participants",
    "member = {:memberId}",
    "",
    500,
    0,
    {
      memberId: event.record.id,
    },
  );

  participantRecords.forEach((participantRecord) => {
    let eventRecord;

    try {
      eventRecord = dao.findRecordById(
        "events",
        participantRecord.getString("event"),
      );
    } catch {
      return;
    }

    if (!["draft", "active"].includes(eventRecord.getString("status"))) {
      return;
    }

    const alreadyExcluded =
      participantRecord.getString("game_participation_status") ===
        "not_playing" &&
      !participantRecord.getString("participation_token_hash");

    if (!alreadyExcluded) {
      participantRecord.set("game_participation_status", "not_playing");
      participantRecord.set("participation_token_hash", "");
      participantRecord.set(
        "version",
        participantRecord.getInt("version") + 1,
      );

      dao.saveRecord(participantRecord);
    }

  });
}, "members");
