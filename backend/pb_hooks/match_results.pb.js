// @ts-nocheck
/// <reference path="../pb_data/types.d.ts" />

routerAdd(
  "POST",
  "/api/somoim/public/match-games/:matchGameId/result/context",
  (context) => {
    const requestData = new DynamicModel({
      responseToken: "",
    });

    context.bind(requestData);

    const responseToken = String(requestData.responseToken || "").trim();

    if (!responseToken) {
      throw new BadRequestError("참가자 인증 정보가 필요합니다.");
    }

    const service = require(`${__hooks}/match_results_service.js`);

    const result = service.buildResultContext(
      service.TARGET_TYPE_TEAM_GAME,
      context.pathParam("matchGameId"),
      responseToken,
    );

    return context.json(200, result);
  },
);

routerAdd(
  "POST",
  "/api/somoim/public/match-games/:matchGameId/result",
  (context) => {
    const requestData = new DynamicModel({
      requestId: "",
      responseToken: "",
      expectedVersion: 0,
      homeScore: 0,
      awayScore: 0,
    });

    context.bind(requestData);

    const responseToken = String(requestData.responseToken || "").trim();

    if (!responseToken) {
      throw new BadRequestError("참가자 인증 정보가 필요합니다.");
    }

    const service = require(`${__hooks}/match_results_service.js`);

    const result = service.saveResultSubmission(
      service.TARGET_TYPE_TEAM_GAME,
      context.pathParam("matchGameId"),
      {
        requestId: requestData.requestId,
        responseToken,
        expectedVersion: requestData.expectedVersion,
        homeScore: requestData.homeScore,
        awayScore: requestData.awayScore,
      },
    );

    return context.json(200, result);
  },
);

routerAdd(
  "POST",
  "/api/somoim/public/individual-matches/:individualMatchId/result/context",
  (context) => {
    const requestData = new DynamicModel({
      responseToken: "",
    });

    context.bind(requestData);

    const responseToken = String(requestData.responseToken || "").trim();

    if (!responseToken) {
      throw new BadRequestError("참가자 인증 정보가 필요합니다.");
    }

    const service = require(`${__hooks}/match_results_service.js`);

    const result = service.buildResultContext(
      service.TARGET_TYPE_INDIVIDUAL_MATCH,
      context.pathParam("individualMatchId"),
      responseToken,
    );

    return context.json(200, result);
  },
);

routerAdd(
  "POST",
  "/api/somoim/public/individual-matches/:individualMatchId/result",
  (context) => {
    const requestData = new DynamicModel({
      requestId: "",
      responseToken: "",
      expectedVersion: 0,
      homeScore: 0,
      awayScore: 0,
    });

    context.bind(requestData);

    const responseToken = String(requestData.responseToken || "").trim();

    if (!responseToken) {
      throw new BadRequestError("참가자 인증 정보가 필요합니다.");
    }

    const service = require(`${__hooks}/match_results_service.js`);

    const result = service.saveResultSubmission(
      service.TARGET_TYPE_INDIVIDUAL_MATCH,
      context.pathParam("individualMatchId"),
      {
        requestId: requestData.requestId,
        responseToken,
        expectedVersion: requestData.expectedVersion,
        homeScore: requestData.homeScore,
        awayScore: requestData.awayScore,
      },
    );

    return context.json(200, result);
  },
);
