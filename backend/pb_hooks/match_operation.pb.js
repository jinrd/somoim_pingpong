// @ts-nocheck
/// <reference path="../pb_data/types.d.ts" />

routerAdd(
  "POST",
  "/api/somoim/admin/game-settings/:gameSettingId/individual-operation/start",
  (context) => {
    const service = require(`${__hooks}/match_operation_service.js`);

    const result = service.startIndividualLeague(
      context.pathParam("gameSettingId"),
    );

    return context.json(200, result);
  },
  require(`${__hooks}/admin_auth.js`).requireActiveAdmin,
);
