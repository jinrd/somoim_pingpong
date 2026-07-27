/**
 * 해당 회차에 이미 시작되었거나 완료된 경기가 있는지 확인합니다.
 */
function hasStartedOrCompletedMatches(dao, eventId) {
  if (!eventId) {
    throw new BadRequestError("회차 정보가 올바르지 않습니다.");
  }

  const teamMatches = dao.findRecordsByFilter(
    "team_matches",
    [
      "event = {:eventId}",
      "(status = 'in_progress' || status = 'completed')",
    ].join(" && "),
    "",
    1,
    0,
    { eventId },
  );

  if (teamMatches.length > 0) {
    return true;
  }

  const individualMatches = dao.findRecordsByFilter(
    "individual_matches",
    [
      "event = {:eventId}",
      "(status = 'in_progress' || status = 'completed')",
    ].join(" && "),
    "",
    1,
    0,
    { eventId },
  );

  return individualMatches.length > 0;
}

/**
 * 경기가 시작된 회차의 참가 상태, 소속 팀 등
 * 경기 구성에 영향을 주는 정보 변경을 차단합니다.
 */
function assertEventRosterEditable(dao, eventId) {
  if (hasStartedOrCompletedMatches(dao, eventId)) {
    throw new BadRequestError(
      "이미 진행 중이거나 완료된 경기가 있어 참가 정보를 변경할 수 없습니다.",
    );
  }
}

module.exports = {
  assertEventRosterEditable,
  hasStartedOrCompletedMatches,
};
