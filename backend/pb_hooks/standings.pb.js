// @ts-nocheck
/// <reference path="../pb_data/types.d.ts" />

routerAdd(
  "GET",
  "/api/somoim/admin/game-settings/:gameSettingId/standings",
  (context) => {
    const service = require(`${__hooks}/standings_service.js`);

    const result = service.buildStandingsBySetting(
      context.pathParam("gameSettingId"),
    );

    return context.json(200, result);
  },
  require(`${__hooks}/admin_auth.js`).requireActiveAdmin,
);

routerAdd("POST", "/api/somoim/public/standings", (context) => {
  const requestData = new DynamicModel({
    responseToken: "",
  });

  context.bind(requestData);

  const responseToken = String(requestData.responseToken || "").trim();

  if (!responseToken) {
    throw new BadRequestError("본인 확인 정보가 필요합니다.");
  }

  const service = require(`${__hooks}/standings_service.js`);

  const result = service.buildPublicStandings(responseToken);

  return context.json(200, result);
});
