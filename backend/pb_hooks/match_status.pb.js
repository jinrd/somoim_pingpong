// @ts-nocheck
/// <reference path="../pb_data/types.d.ts" />

routerAdd(
  "PATCH",
  "/api/somoim/admin/team-matches/:matchId/status",
  (context) => {
    const requestData = new DynamicModel({
      expectedVersion: 0,
      nextStatus: "",
    });

    context.bind(requestData);

    const service = require(`${__hooks}/match_status_service.js`);

    const result = service.changeTeamMatchStatus(context.pathParam("matchId"), {
      expectedVersion: requestData.expectedVersion,
      nextStatus: requestData.nextStatus,
    });

    return context.json(200, result);
  },
  require(`${__hooks}/admin_auth.js`).requireActiveAdmin,
);

routerAdd(
  "PATCH",
  "/api/somoim/admin/individual-matches/:matchId/status",
  (context) => {
    const requestData = new DynamicModel({
      expectedVersion: 0,
      nextStatus: "",
    });

    context.bind(requestData);

    const service = require(`${__hooks}/match_status_service.js`);

    const result = service.changeIndividualMatchStatus(
      context.pathParam("matchId"),
      {
        expectedVersion: requestData.expectedVersion,
        nextStatus: requestData.nextStatus,
      },
    );

    return context.json(200, result);
  },
  require(`${__hooks}/admin_auth.js`).requireActiveAdmin,
);
