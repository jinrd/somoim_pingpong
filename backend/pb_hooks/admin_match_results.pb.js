// @ts-nocheck
/// <reference path="../pb_data/types.d.ts" />

routerAdd(
  "POST",
  "/api/somoim/admin/match-games/:matchId/result/confirm",
  (context) => {
    const requestData = new DynamicModel({
      requestId: "",
      expectedVersion: 0,
      homeScore: 0,
      awayScore: 0,
      reason: "",
      homeParticipantIds: [],
      awayParticipantIds: [],
    });

    context.bind(requestData);

    const requestInfo = $apis.requestInfo(context);
    const admin = requestInfo.authRecord;

    if (!admin) {
      throw new UnauthorizedError("로그인이 필요합니다.");
    }

    const service = require(`${__hooks}/admin_match_results_service.js`);

    const result = service.confirmTeamGameResult(
      context.pathParam("matchId"),
      {
        requestId: requestData.requestId,
        expectedVersion: requestData.expectedVersion,
        homeScore: requestData.homeScore,
        awayScore: requestData.awayScore,
        reason: requestData.reason,
        homeParticipantIds: requestData.homeParticipantIds,
        awayParticipantIds: requestData.awayParticipantIds,
        adminId: admin.id,
        adminName:
          admin.getString("name") || admin.getString("email") || "관리자",
      },
    );

    return context.json(200, result);
  },
  require(`${__hooks}/admin_auth.js`).requireActiveAdmin,
);

routerAdd(
  "POST",
  "/api/somoim/admin/individual-matches/:matchId/result/confirm",
  (context) => {
    const requestData = new DynamicModel({
      requestId: "",
      expectedVersion: 0,
      homeScore: 0,
      awayScore: 0,
      reason: "",
    });

    context.bind(requestData);

    const requestInfo = $apis.requestInfo(context);
    const admin = requestInfo.authRecord;

    if (!admin) {
      throw new UnauthorizedError("로그인이 필요합니다.");
    }

    const service = require(`${__hooks}/admin_match_results_service.js`);

    const result = service.confirmIndividualMatchResult(
      context.pathParam("matchId"),
      {
        requestId: requestData.requestId,
        expectedVersion: requestData.expectedVersion,
        homeScore: requestData.homeScore,
        awayScore: requestData.awayScore,
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

routerAdd(
  "POST",
  "/api/somoim/admin/match-games/:matchId/result/cancel",
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

    const result = service.cancelTeamGameResult(context.pathParam("matchId"), {
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
