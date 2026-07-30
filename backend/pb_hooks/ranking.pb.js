// @ts-nocheck
/// <reference path="../pb_data/types.d.ts" />

const rankingAdminMiddleware = require(
  `${__hooks}/admin_auth.js`,
).requireActiveAdmin;

const getRankingAdmin = (context) => {
  const requestInfo = $apis.requestInfo(context);
  const adminRecord = requestInfo.authRecord;

  if (!adminRecord) {
    throw new UnauthorizedError("로그인이 필요합니다.");
  }

  return adminRecord;
};

routerAdd(
  "GET",
  "/api/somoim/admin/rankings/overview",
  (context) => {
    const service = require(`${__hooks}/ranking_service.js`);

    return context.json(
      200,
      service.getRankingOverview($app.dao()),
    );
  },
  rankingAdminMiddleware,
);

routerAdd(
  "POST",
  "/api/somoim/admin/rankings/recalculate",
  (context) => {
    const service = require(`${__hooks}/ranking_service.js`);

    service.recalculateAllCandidates($app.dao());

    return context.json(200, service.getRankingOverview($app.dao()));
  },
  rankingAdminMiddleware,
);

routerAdd(
  "GET",
  "/api/somoim/admin/members/:memberId/ranking",
  (context) => {
    const service = require(`${__hooks}/ranking_service.js`);

    return context.json(
      200,
      service.getMemberRankingDetail(
        $app.dao(),
        context.pathParam("memberId"),
      ),
    );
  },
  rankingAdminMiddleware,
);

const reviewCandidate = (context, action) => {
  const requestData = new DynamicModel({
    expectedVersion: 0,
    note: "",
  });

  context.bind(requestData);

  const adminRecord = getRankingAdmin(context);
  const service = require(`${__hooks}/ranking_service.js`);
  const input = {
    expectedVersion: requestData.expectedVersion,
    note: requestData.note,
    adminId: adminRecord.id,
  };
  const candidateId = context.pathParam("candidateId");

  const result =
    action === "approve"
      ? service.approveCandidate(candidateId, input)
      : service.rejectCandidate(candidateId, input);

  return context.json(200, result);
};

routerAdd(
  "POST",
  "/api/somoim/admin/ranking-candidates/:candidateId/approve",
  (context) => reviewCandidate(context, "approve"),
  rankingAdminMiddleware,
);

routerAdd(
  "POST",
  "/api/somoim/admin/ranking-candidates/:candidateId/reject",
  (context) => reviewCandidate(context, "reject"),
  rankingAdminMiddleware,
);

/*
 * 회원 수정 화면에서 부수를 직접 변경한 경우에도 변경 이력을 남기고,
 * 이전 경기로 계산된 후보가 다시 사용되지 않도록 연속 기록 기준점을 갱신합니다.
 */
onRecordAfterUpdateRequest((event) => {
  const originalRecord = event.record.originalCopy();
  const previousRank = originalRecord.getInt("rank");
  const nextRank = event.record.getInt("rank");
  const previousStatus = originalRecord.getString("status");
  const nextStatus = event.record.getString("status");
  const service = require(`${__hooks}/ranking_service.js`);

  if (previousRank === nextRank && previousStatus === nextStatus) {
    return;
  }

  if (previousRank !== nextRank) {
    const requestInfo = $apis.requestInfo(event.httpContext);
    const adminRecord = requestInfo.authRecord;

    service.recordManualRankChange(
      $app.dao(),
      event.record,
      previousRank,
      adminRecord ? adminRecord.id : "",
    );
    return;
  }

  /*
   * 활동 상태만 바뀐 경우에도 대기 중인 후보를 즉시 다시 계산합니다.
   * 비활동 회원에게는 새 후보가 유지되지 않습니다.
   */
  service.recalculateMemberCandidate($app.dao(), event.record.id);
}, "members");

const recalculateAfterRankSettingChange = () => {
  const service = require(`${__hooks}/ranking_service.js`);

  service.recalculateAllCandidates($app.dao());
};

const validateRankSettings = (event) => {
  const record = event.record;
  const minRank = record.getInt("min_rank");
  const maxRank = record.getInt("max_rank");
  const promotionThreshold = record.getInt("promotion_threshold");
  const demotionThreshold = record.getInt("demotion_threshold");

  if (minRank < 0 || maxRank <= minRank) {
    throw new BadRequestError("최고 부수와 최저 부수 범위를 확인해 주세요.");
  }

  if (promotionThreshold < 1 || demotionThreshold < 1) {
    throw new BadRequestError("승급·강등 기준 횟수는 1 이상이어야 합니다.");
  }
};

onRecordBeforeCreateRequest(validateRankSettings, "rank_settings");
onRecordBeforeUpdateRequest(validateRankSettings, "rank_settings");

onRecordAfterCreateRequest(
  recalculateAfterRankSettingChange,
  "rank_settings",
);

onRecordAfterUpdateRequest(
  recalculateAfterRankSettingChange,
  "rank_settings",
);
