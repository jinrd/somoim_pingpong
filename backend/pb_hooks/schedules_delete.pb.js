// @ts-nocheck
/// <reference path="../pb_data/types.d.ts" />

/**
 * 대진표 초기화(삭제)
 *
 * DELETE /api/somoim/admin/game-settings/:gameSettingId/schedule
 */
routerAdd(
  "DELETE",
  "/api/somoim/admin/game-settings/:gameSettingId/schedule",
  (context) => {
    const gameSettingId = context.pathParam("gameSettingId");
    const dao = $app.dao();

    let gameSetting;
    try {
      gameSetting = dao.findRecordById("event_game_settings", gameSettingId);
    } catch {
      throw new NotFoundError("게임 설정 정보를 찾을 수 없습니다.");
    }

    const eventId = gameSetting.getString("event");

    /*
     * 진행 중이거나 완료된 경기가 있으면 대진표를 삭제할 수 없습니다.
     */
    const matchIntegrity = require(`${__hooks}/event_match_integrity.js`);
    matchIntegrity.assertEventRosterEditable(dao, eventId);

    dao.runInTransaction((txDao) => {
      if (gameSetting.getString("competition_type") === "team_league") {
        const matches = txDao.findRecordsByFilter(
          "team_matches",
          "game_setting = {:gameSettingId}",
          "",
          500,
          0,
          { gameSettingId },
        );

        matches.forEach((m) => txDao.deleteRecord(m));
      } else if (
        gameSetting.getString("competition_type") === "individual_singles"
      ) {
        const matches = txDao.findRecordsByFilter(
          "individual_matches",
          "game_setting = {:gameSettingId}",
          "",
          500,
          0,
          { gameSettingId },
        );

        matches.forEach((m) => txDao.deleteRecord(m));
      }
    });

    return context.noContent(204);
  },
  require(`${__hooks}/admin_auth.js`).requireActiveAdmin,
);
