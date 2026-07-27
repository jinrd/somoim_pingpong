/// <reference path="../pb_data/types.d.ts" />

function assertGameSettingRequestAllowed(eventRecord, dao) {
  const workflow = require(`${__hooks}/event_workflow_service.js`);
  const somoimEvent = dao.findRecordById(
    "events",
    eventRecord.getString("event"),
  );

  workflow.assertRegistrationClosed(somoimEvent);
  workflow.assertNoUndecidedParticipants(dao, somoimEvent.id);
  workflow.assertSetupEditable(dao, somoimEvent.id);
}

onRecordBeforeCreateRequest((event) => {
  assertGameSettingRequestAllowed(event.record, $app.dao());

  if (event.record.getString("status") !== "draft") {
    throw new BadRequestError(
      "게임 설정은 초안으로 저장한 뒤 최종 확정해 주세요.",
    );
  }
}, "event_game_settings");

onRecordBeforeUpdateRequest((event) => {
  const dao = $app.dao();
  const originalRecord = dao.findRecordById(
    "event_game_settings",
    event.record.id,
  );

  assertGameSettingRequestAllowed(event.record, dao);

  if (originalRecord.getString("status") === "confirmed") {
    throw new BadRequestError(
      "확정된 게임 설정입니다. '게임 설정 수정'을 눌러 기존 경기 구성을 초기화한 후 변경해 주세요.",
    );
  }

  if (event.record.getString("status") !== originalRecord.getString("status")) {
    throw new BadRequestError(
      "게임 설정 상태는 최종 확정 버튼으로만 변경할 수 있습니다.",
    );
  }
}, "event_game_settings");

onRecordBeforeDeleteRequest(() => {
  throw new BadRequestError(
    "게임 설정은 화면의 초기화 절차를 통해서만 삭제할 수 있습니다.",
  );
}, "event_game_settings");
