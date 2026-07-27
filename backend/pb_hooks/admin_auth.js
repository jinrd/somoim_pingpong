/**
 * users 인증과 관리자 권한을 함께 검사하는 공통 미들웨어입니다.
 */
const requireActiveAdmin = function (next) {
  /*
   * 먼저 PocketBase의 정식 인증 미들웨어로
   * users 컬렉션 토큰인지 검증합니다.
   */
  const checkAdminRole = function (context) {
    const requestInfo = $apis.requestInfo(context);
    const authRecord = requestInfo.authRecord;

    if (!authRecord) {
      throw new UnauthorizedError("로그인이 필요합니다.");
    }

    if (authRecord.collection().name !== "users") {
      throw new ForbiddenError("관리자 계정만 접근할 수 있습니다.");
    }

    if (authRecord.getString("role") !== "admin") {
      throw new ForbiddenError("관리자 권한이 필요합니다.");
    }

    if (!authRecord.getBool("active")) {
      throw new ForbiddenError("비활성화된 관리자 계정입니다.");
    }

    return next(context);
  };

  return $apis.requireRecordAuth("users")(checkAdminRole);
};

module.exports = Object.freeze({
  requireActiveAdmin,
});
