/// <reference path="../pb_data/types.d.ts" />

/*
 * 관리자 화면의 일반 Record API를 직접 호출해도
 * 비활동 회원을 회차에 새로 추가할 수 없게 합니다.
 */
onRecordBeforeCreateRequest((event) => {
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
  if (event.record.getString("game_participation_status") === "not_playing") {
    return;
  }

  const integrity = require(`${__hooks}/event_participant_integrity.js`);

  integrity.ensureActiveParticipantMember(event.record);
}, "event_participants");

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

  const invalidatedFormationIds = new Set();

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

    /*
     * 이미 팀에 들어간 회원이라면 기존 편성을 draft로 되돌립니다.
     * 팀과 대진 기록은 즉시 삭제하지 않고 운영자가 재편성하도록 막습니다.
     */
    const teamMemberRecords = dao.findRecordsByFilter(
      "team_members",
      "participant = {:participantId}",
      "",
      100,
      0,
      {
        participantId: participantRecord.id,
      },
    );

    teamMemberRecords.forEach((teamMemberRecord) => {
      const formationId = teamMemberRecord.getString("formation");

      if (!formationId || invalidatedFormationIds.has(formationId)) {
        return;
      }

      let formationRecord;

      try {
        formationRecord = dao.findRecordById("team_formations", formationId);
      } catch {
        return;
      }

      formationRecord.set("status", "draft");
      formationRecord.set("version", formationRecord.getInt("version") + 1);

      dao.saveRecord(formationRecord);
      invalidatedFormationIds.add(formationId);
    });
  });
}, "members");
