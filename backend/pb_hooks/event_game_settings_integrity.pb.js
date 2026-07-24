/// <reference path="../pb_data/types.d.ts" />

/*
 * 게임 설정(event_game_settings) 변경 방어
 * 대진표가 하나라도 생성되어 있다면 핵심 설정 변경을 차단합니다.
 */
onRecordBeforeUpdateRequest((event) => {
  const dao = $app.dao();
  const gameSettingId = event.record.id;

  // 1. 기존 데이터와 수정 요청 데이터의 핵심 필드 비교
  const originalRecord = dao.findRecordById(
    "event_game_settings",
    gameSettingId,
  );
  const oldType = originalRecord.getString("competition_type");
  const newType = event.record.getString("competition_type");

  // 운영 방식(competition_type)이 변경되지 않았다면 일단 통과
  // (필요하다면 팀 인원수나 경기 판수 등 다른 필드 검증도 이 아래에 추가할 수 있습니다)
  if (oldType === newType) {
    return;
  }

  // 2. 이미 생성된 대진표가 있는지 확인
  let hasMatches = false;

  if (oldType === "team_league") {
    // 팀 리그였을 경우, team_matches가 1개라도 있는지 확인
    const teamMatches = dao.findRecordsByFilter(
      "team_matches",
      "game_setting = {:gameSettingId}",
      "",
      1, // 1개만 찾아도 충분함
      0,
      { gameSettingId },
    );

    if (teamMatches.length > 0) hasMatches = true;
  } else {
    // 개인 단식이었을 경우, individual_matches 가 1개라도 있는지 확인
    const individualMatches = dao.findRecordsByFilter(
      "individual_matches",
      "game_setting = {:gameSettingId}",
      "",
      1,
      0,
      { gameSettingId },
    );
    if (individualMatches.length > 0) hasMatches = true;
  }

  // 3. 대신표자 존재하는데 운영 방식을 바꾸려 하면 차단
  if (hasMatches) {
    throw new BadRequestError(
      "이미 대진표가 생성되어 운영 방식을 변경할 수 없습니다. 방식을 바꾸려면 대진표를 먼저 삭제(초기화)해 주세요.",
    );
  }
}, "event_game_settings");
