/// <reference path="../pb_data/types.d.ts" />

/*
 * 참가자용 자기 팀 라인업 조회
 *
 * POST /api/somoim/public/team-matches/:teamMatchId/context

 *
 * 토큰이 URL이나 서버 접근 로그에 노출되지 않도록
 * GET query parameter가 아니라 POST body로 전달합니다.
 */
const handlePublicTeamMatchContext = (context) => {
  const teamMatchId = context.pathParam("teamMatchId");

  const requestData = new DynamicModel({
    responseToken: "",
  });

  context.bind(requestData);

  const service = require(`${__hooks}/team_lineups_service.js`);

  const result = service.buildTeamMatchContext(
    teamMatchId,
    requestData.responseToken,
  );

  return context.json(200, result);
};

routerAdd(
  "POST",
  "/api/somoim/public/team-matches/:teamMatchId/context",
  handlePublicTeamMatchContext,
);

// 기존 공개 링크와의 호환성을 위해 유지
routerAdd(
  "POST",
  "/api/somoim/public/team-matches/:teamMatchId/lineup/context",
  handlePublicTeamMatchContext,
);

/*
 * 참가자용 자기 팀 라인업 전체 저장
 *
 * PUT /api/somoim/public/team-matches/:teamMatchId/lineup
 *
 * body:
 * {
 *   responseToken: "...",
 *   expectedVersion: 1,
 *   status: "draft" | "confirmed",
 *   games: [
 *     {
 *       matchGameId: "...",
 *       participantIds: ["...", "..."]
 *     }
 *   ]
 * }
 */
routerAdd(
  "PUT",
  "/api/somoim/public/team-matches/:teamMatchId/lineup",
  (context) => {
    const teamMatchId = context.pathParam("teamMatchId");

    const requestData = new DynamicModel({
      responseToken: "",
      expectedVersion: 0,
      status: "",
      games: [],
    });

    context.bind(requestData);

    const service = require(`${__hooks}/team_lineups_service.js`);

    const result = service.saveLineup(teamMatchId, requestData.responseToken, {
      expectedVersion: requestData.expectedVersion,
      status: requestData.status,
      games: requestData.games,
    });

    return context.json(200, result);
  },
);

/*
 * 본인이 속한 팀의 전체 경기 목록 조회
 *
 * POST /api/somoim/public/team-matches/mine
 */
routerAdd("POST", "/api/somoim/public/team-matches/mine", (context) => {
  const requestData = new DynamicModel({
    responseToken: "",
  });

  context.bind(requestData);

  const service = require(`${__hooks}/team_lineups_service.js`);

  const result = service.listParticipantMatches(requestData.responseToken);

  return context.json(200, result);
});
