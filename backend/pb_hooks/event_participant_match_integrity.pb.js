/// <reference path="../pb_data/types.d.ts" />

/*
 * 참가자 상태 및 팀 소속 변경 방어
 * 이미 경기가 진행 중이거나 완료되었을 때,
 * 참가 인원수나 소속 팀이 바뀌어 대진/라인업 데이터가 꼬이는 것을 막습니다.
 */
onRecordBeforeUpdateRequest((event) => {
  const dao = $app.dao();
  const participantId = event.record.id;

  const originalRecord = dao.findRecordById(
    "event_participants",
    participantId,
  );
  const oldStatus = originalRecord.getString("game_participation_status");
  const newStatus = event.record.getString("game_participation_status");

  const oldTeam = originalRecord.getString("team");
  const newTeam = event.record.getString("team");

  // 참가 상태나 소속 팀이 변경되지 않았다면 무사 통과
  if (oldStatus === newStatus && oldTeam === newTeam) {
    return;
  }

  const eventId = event.record.getString("event");

  // 이 이벤트에 연결된 '진행 중'이거나 '완료'된 경기가 단 하나라도 있는지 확인
  const teamMatches = dao.findRecordsByFilter(
    "team_matches",
    "event = {:eventId} && (status = 'in_progress' || status = 'completed')",
    "",
    1, // 1개만 찾아도 충분
    0,
    { eventId },
  );

  const individualMatches = dao.findRecordsByFilter(
    "individual_matches",
    "event = {:eventId} && (status = 'in_progress' || status = 'completed')",
    "",
    1,
    0,
    { eventId },
  );

  // 경기가 이미 시작되었다면 변경 차단!
  if (teamMatches.length > 0 || individualMatches.length > 0) {
    throw new BadRequestError(
      "이미 진행 중이거나 완료된 경기가 있어 참석 상태나 팀을 변경할 수 없습니다.",
    );
  }

  // (만약 scheduled 상태의 대기 중인 경기만 있다면 통과시켜 줍니다.
  //  이 경우에는 프론트엔드에서 대진표를 덮어씌워(재생성) 해결할 수 있도록 허용합니다.)
}, "event_participants");
