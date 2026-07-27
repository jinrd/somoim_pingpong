/// <reference path="../pb_data/types.d.ts" />

/*
 * 참가자 상태 및 팀 소속 변경 방어
 *
 * 이미 경기가 진행 중이거나 완료되었을 때
 * 참가 상태나 소속 팀이 변경되는 것을 막습니다.
 */
onRecordBeforeUpdateRequest((event) => {
  const dao = $app.dao();

  const originalRecord = dao.findRecordById(
    "event_participants",
    event.record.id,
  );

  const oldStatus = originalRecord.getString("game_participation_status");
  const newStatus = event.record.getString("game_participation_status");

  const oldTeam = originalRecord.getString("team");
  const newTeam = event.record.getString("team");

  /*
   * 참가 상태와 소속 팀이 모두 그대로라면
   * 경기 명단에 영향을 주지 않으므로 허용합니다.
   */
  if (oldStatus === newStatus && oldTeam === newTeam) {
    return;
  }

  const matchIntegrity = require(`${__hooks}/event_match_integrity.js`);

  matchIntegrity.assertEventRosterEditable(
    dao,
    event.record.getString("event"),
  );
}, "event_participants");

/*
 * 참가자 삭제 방어
 *
 * 다음 경우 참석자 삭제를 거절합니다.
 *
 * 1. 회차에 진행 중이거나 완료된 경기가 있는 경우
 * 2. 참가자가 팀 편성에 포함된 경우
 * 3. 참가자가 팀 경기 라인업에 포함된 경우
 * 4. 참가자가 개인 단식 대진에 포함된 경우
 */
onRecordBeforeDeleteRequest((event) => {
  const dao = $app.dao();
  const participantRecord = event.record;

  const participantId = participantRecord.id;
  const eventId = participantRecord.getString("event");

  /*
   * 경기 시작 후에는 어떤 참가자도 삭제할 수 없습니다.
   */
  const matchIntegrity = require(`${__hooks}/event_match_integrity.js`);

  matchIntegrity.assertEventRosterEditable(dao, eventId);

  /*
   * 아직 경기가 시작되지 않았더라도
   * 기존 팀 편성에 포함된 참가자는 바로 삭제하지 않습니다.
   *
   * 먼저 팀 편성을 다시 구성해야 합니다.
   */
  const teamMemberRecords = dao.findRecordsByFilter(
    "team_members",
    "participant = {:participantId}",
    "",
    1,
    0,
    { participantId },
  );

  if (teamMemberRecords.length > 0) {
    throw new BadRequestError(
      "팀 편성에 포함된 참석자입니다. 팀 편성을 다시 구성한 후 삭제해 주세요.",
    );
  }

  /*
   * 확정되거나 작성 중인 팀 경기 라인업 참조 확인
   */
  const lineupPlayerRecords = dao.findRecordsByFilter(
    "match_game_players",
    "participant = {:participantId}",
    "",
    1,
    0,
    { participantId },
  );

  if (lineupPlayerRecords.length > 0) {
    throw new BadRequestError(
      "팀 경기 라인업에 포함된 참석자이므로 삭제할 수 없습니다.",
    );
  }

  /*
   * 개인 단식 대진 참조 확인
   *
   * individual_matches의 참가자 relation에는 cascadeDelete가 설정되어 있어
   * 이 검사가 없으면 참석자를 삭제할 때 대진도 같이 사라질 수 있습니다.
   */
  const individualMatchRecords = dao.findRecordsByFilter(
    "individual_matches",
    [
      "event = {:eventId}",
      "(",
      "home_participant = {:participantId}",
      "|| away_participant = {:participantId}",
      ")",
    ].join(" "),
    "",
    1,
    0,
    {
      eventId,
      participantId,
    },
  );

  if (individualMatchRecords.length > 0) {
    throw new BadRequestError(
      "개인 단식 대진에 포함된 참석자입니다. 대진을 다시 구성한 후 삭제해 주세요.",
    );
  }
}, "event_participants");
