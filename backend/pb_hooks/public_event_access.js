/**
 * 공개 링크 검증 실패 시 동일한 메시지를 사용합니다.
 *
 * 링크 존재 여부, 비활성화 여부, 만료 여부를 구분해서 알려주지 않아
 * 외부 사용자가 링크 상태를 추측하기 어렵게 합니다.
 */
const PUBLIC_ACCESS_ERROR_MESSAGE = "유효하지 않거나 만료된 참석 링크입니다.";

/**
 * 조회된 회차가 현재 공개 접근 가능한지 검사합니다.
 */
const assertEventPublicAccess = function (eventRecord) {
  if (!eventRecord) {
    throw new NotFoundError(PUBLIC_ACCESS_ERROR_MESSAGE);
  }

  if (!eventRecord.getBool("public_access_enabled")) {
    throw new NotFoundError(PUBLIC_ACCESS_ERROR_MESSAGE);
  }

  const expiresAt = eventRecord.getString("public_expires_at");

  const expiresAtTimestamp = new Date(expiresAt).getTime();

  if (
    !expiresAt ||
    !Number.isFinite(expiresAtTimestamp) ||
    expiresAtTimestamp <= Date.now()
  ) {
    throw new NotFoundError(PUBLIC_ACCESS_ERROR_MESSAGE);
  }

  if (eventRecord.getString("status") === "archived") {
    throw new NotFoundError(PUBLIC_ACCESS_ERROR_MESSAGE);
  }

  return eventRecord;
};

/**
 * 공개 링크 원본 토큰으로 회차를 조회하고
 * 활성화, 만료 시각, 회차 상태를 함께 검증합니다.
 */
const findEventByPublicToken = function (publicToken) {
  const config = require(`${__hooks}/config.js`);

  const normalizedToken = String(publicToken || "").trim();

  if (
    !normalizedToken ||
    normalizedToken.length !== config.PUBLIC_LINK_TOKEN_LENGTH
  ) {
    throw new NotFoundError(PUBLIC_ACCESS_ERROR_MESSAGE);
  }

  let eventRecord;

  try {
    eventRecord = $app
      .dao()
      .findFirstRecordByFilter("events", "public_token_hash = {:tokenHash}", {
        tokenHash: $security.sha256(normalizedToken),
      });
  } catch {
    throw new NotFoundError(PUBLIC_ACCESS_ERROR_MESSAGE);
  }

  return assertEventPublicAccess(eventRecord);
};

module.exports = Object.freeze({
  assertEventPublicAccess,
  findEventByPublicToken,
});
