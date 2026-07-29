/// <reference path="../pb_data/types.d.ts" />

/*
 * macOS의 Docker bind mount에서 PocketBase 요청 로그 DB(logs.db)가
 * 반복 손상되는 문제를 피하기 위해 요청 로그 저장을 비활성화합니다.
 *
 * 경기 결과 이력과 부수 변경 이력은 data.db의 별도 컬렉션에 계속 보존됩니다.
 * 배포 환경에서 로그 전용 안정적인 볼륨을 구성하면 maxDays를 다시 늘릴 수 있습니다.
 */
migrate(
  (db) => {
    const dao = new Dao(db);
    const settings = dao.findSettings();

    settings.logs.maxDays = 0;
    settings.logs.logIp = false;

    dao.saveSettings(settings);
  },

  (db) => {
    const dao = new Dao(db);
    const settings = dao.findSettings();

    settings.logs.maxDays = 5;
    settings.logs.logIp = true;

    dao.saveSettings(settings);
  },
);
