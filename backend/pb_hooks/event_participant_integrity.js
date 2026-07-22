const ensureActiveParticipantMember = function (participantRecord) {
  if (participantRecord.getString("participant_type") !== "member") {
    return;
  }

  const memberId = participantRecord.getString("member");

  if (!memberId) {
    throw new BadRequestError("회원 참석자 정보가 올바르지 않습니다.");
  }

  let memberRecord;

  try {
    memberRecord = $app.dao().findRecordById("members", memberId);
  } catch {
    throw new BadRequestError("회원 정보를 찾을 수 없습니다.");
  }

  if (memberRecord.getString("status") !== "active") {
    throw new BadRequestError(
      "비활동 회원은 회차 참석자로 등록하거나 게임에 참가할 수 없습니다.",
    );
  }
};

module.exports = Object.freeze({
  ensureActiveParticipantMember,
});
