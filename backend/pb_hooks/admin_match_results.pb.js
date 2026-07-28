// @ts-nocheck
/// <reference path="../pb_data/types.d.ts" />

routerAdd(
  "POST",
  "/api/somoim/admin/team-matches/:matchId/result/cancel",
  (context) => {
    const requestData = new DynamicModel({
      requestId: "",
      expectedVersion: 0,
      reason: "",
    });

    context.bind(requestData);

    const requestInfo = $apis.requestInfo(context);
    const admin = requestInfo.authRecord;

    if (!admin) {
      throw new UnauthorizedError("로그인이 필요합니다.");
    }

    const service = require(`${__hooks}/admin_match_results_service.js`);

    const result = service.cancelTeamMatchResult(context.pathParam("matchId"), {
      requestId: requestData.requestId,
      expectedVersion: requestData.expectedVersion,
      reason: requestData.reason,
      adminId: admin.id,
      adminName:
        admin.getString("name") || admin.getString("email") || "관리자",
    });

    return context.json(200, result);
  },
  require(`${__hooks}/admin_auth.js`).requireActiveAdmin,
);

routerAdd(
  "POST",
  "/api/somoim/admin/individual-matches/:matchId/result/cancel",
  (context) => {
    const requestData = new DynamicModel({
      requestId: "",
      expectedVersion: 0,
      reason: "",
    });

    context.bind(requestData);

    const requestInfo = $apis.requestInfo(context);
    const admin = requestInfo.authRecord;

    if (!admin) {
      throw new UnauthorizedError("로그인이 필요합니다.");
    }

    const service = require(`${__hooks}/admin_match_results_service.js`);

    const result = service.cancelIndividualMatchResult(
      context.pathParam("matchId"),
      {
        requestId: requestData.requestId,
        expectedVersion: requestData.expectedVersion,
        reason: requestData.reason,
        adminId: admin.id,
        adminName:
          admin.getString("name") || admin.getString("email") || "관리자",
      },
    );

    return context.json(200, result);
  },
  require(`${__hooks}/admin_auth.js`).requireActiveAdmin,
);
