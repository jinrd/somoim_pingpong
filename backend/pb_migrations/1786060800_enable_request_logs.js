/// <reference path="../pb_data/types.d.ts" />

/*
 * PocketBase 요청 로그를 다시 저장하고 30일 동안 보관합니다.
 * IP 주소는 개인정보 보호를 위해 계속 기록하지 않습니다.
 */
migrate(
  (db) => {
    const dao = new Dao(db);
    const settings = dao.findSettings();

    settings.logs.maxDays = 30;
    settings.logs.logIp = false;

    dao.saveSettings(settings);
  },
  (db) => {
    const dao = new Dao(db);
    const settings = dao.findSettings();

    settings.logs.maxDays = 0;
    settings.logs.logIp = false;

    dao.saveSettings(settings);
  },
);
