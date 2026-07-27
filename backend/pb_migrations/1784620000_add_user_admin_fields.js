/// <reference path="../pb_data/types.d.ts" />

migrate(
  (db) => {
    const dao = new Dao(db);
    const usersCollection = dao.findCollectionByNameOrId("users");
    const fields = usersCollection.schema.asMap();

    /*
     * 기존 사용자 레코드를 먼저 보정해야 하므로
     * 처음에는 role을 선택 필드로만 추가합니다.
     */
    if (!fields.role) {
      usersCollection.schema.addField(
        new SchemaField({
          id: "userrolefld",
          name: "role",
          type: "select",
          required: false,
          options: {
            maxSelect: 1,
            values: ["admin", "operator"],
          },
        }),
      );
    }

    /*
     * PocketBase bool은 false도 정상값이므로 required를 false로 둡니다.
     */
    if (!fields.active) {
      usersCollection.schema.addField(
        new SchemaField({
          id: "useractivefl",
          name: "active",
          type: "bool",
          required: false,
        }),
      );
    }

    dao.saveCollection(usersCollection);

    /*
     * 현재 존재하는 users 계정은 모두 기존 관리자 계정으로 간주합니다.
     */
    const existingUsers = dao.findRecordsByFilter(
      "users",
      "id != ''",
      "",
      500,
      0,
    );

    existingUsers.forEach((userRecord) => {
      userRecord.set("role", "admin");
      userRecord.set("active", true);

      dao.saveRecord(userRecord);
    });

    /*
     * 기존 사용자 보정 후 role을 필수 필드로 변경합니다.
     */
    usersCollection.schema.getFieldByName("role").required = true;

    dao.saveCollection(usersCollection);

    /*
     * 일반 Record API도 관리자 권한을 검사하도록 변경합니다.
     *
     * null인 규칙은 원래부터 직접 API 접근이 금지된 것이므로
     * 그대로 유지합니다.
     */
    const adminRule =
      "@request.auth.id != ''" +
      " && @request.auth.role = 'admin'" +
      " && @request.auth.active = true";

    const protectedCollections = [
      "members",
      "rank_settings",
      "default_ranks",
      "events",
      "event_participants",
      "event_game_settings",
      "event_match_formats",
      "team_formations",
      "teams",
      "team_members",
      "team_matches",
      "match_games",
      "team_match_lineups",
      "match_game_players",
      "individual_matches",
    ];

    protectedCollections.forEach((collectionName) => {
      let collection;

      try {
        collection = dao.findCollectionByNameOrId(collectionName);
      } catch {
        /*
         * 현재 프로젝트 버전에 없는 컬렉션은 건너뜁니다.
         */
        return;
      }

      const ruleNames = [
        "listRule",
        "viewRule",
        "createRule",
        "updateRule",
        "deleteRule",
      ];

      ruleNames.forEach((ruleName) => {
        if (collection[ruleName] !== null) {
          collection[ruleName] = adminRule;
        }
      });

      dao.saveCollection(collection);
    });
  },

  (db) => {
    const dao = new Dao(db);

    /*
     * 직접 Record API 규칙을 기존 로그인 사용자 조건으로 복구합니다.
     */
    const protectedCollections = [
      "members",
      "rank_settings",
      "default_ranks",
      "events",
      "event_participants",
      "event_game_settings",
      "event_match_formats",
      "team_formations",
      "teams",
      "team_members",
      "team_matches",
      "match_games",
      "team_match_lineups",
      "match_game_players",
      "individual_matches",
    ];

    protectedCollections.forEach((collectionName) => {
      let collection;

      try {
        collection = dao.findCollectionByNameOrId(collectionName);
      } catch {
        return;
      }

      const ruleNames = [
        "listRule",
        "viewRule",
        "createRule",
        "updateRule",
        "deleteRule",
      ];

      ruleNames.forEach((ruleName) => {
        if (collection[ruleName] !== null) {
          collection[ruleName] = "@request.auth.id != ''";
        }
      });

      dao.saveCollection(collection);
    });

    const usersCollection = dao.findCollectionByNameOrId("users");

    if (usersCollection.schema.asMap().role) {
      usersCollection.schema.removeField("userrolefld");
    }

    if (usersCollection.schema.asMap().active) {
      usersCollection.schema.removeField("useractivefl");
    }

    dao.saveCollection(usersCollection);
  },
);
