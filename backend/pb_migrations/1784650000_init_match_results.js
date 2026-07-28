/// <reference path="../pb_data/types.d.ts" />

migrate(
  (db) => {
    const dao = new Dao(db);

    const eventsCollection = dao.findCollectionByNameOrId("events");
    const participantsCollection =
      dao.findCollectionByNameOrId("event_participants");
    const matchGamesCollection = dao.findCollectionByNameOrId("match_games");
    const individualMatchesCollection =
      dao.findCollectionByNameOrId("individual_matches");

    /*
     * 팀 세부 경기와 개인 단식 경기에 공통 결과 필드를 추가합니다.
     */
    const addResultFields = (collection, fieldIds) => {
      const fields = collection.schema.asMap();

      if (!fields.result_status) {
        collection.schema.addField(
          new SchemaField({
            id: fieldIds.resultStatus,
            name: "result_status",
            type: "select",
            required: false,
            options: {
              maxSelect: 1,
              values: ["pending", "disputed", "confirmed"],
            },
          }),
        );
      }

      /*
       * 0점도 정상값이므로 required를 false로 둡니다.
       */
      if (!fields.home_score) {
        collection.schema.addField(
          new SchemaField({
            id: fieldIds.homeScore,
            name: "home_score",
            type: "number",
            required: false,
            options: {
              min: 0,
              max: null,
              noDecimal: true,
            },
          }),
        );
      }

      if (!fields.away_score) {
        collection.schema.addField(
          new SchemaField({
            id: fieldIds.awayScore,
            name: "away_score",
            type: "number",
            required: false,
            options: {
              min: 0,
              max: null,
              noDecimal: true,
            },
          }),
        );
      }

      if (!fields.winner_side) {
        collection.schema.addField(
          new SchemaField({
            id: fieldIds.winnerSide,
            name: "winner_side",
            type: "select",
            required: false,
            options: {
              maxSelect: 1,
              values: ["home", "away"],
            },
          }),
        );
      }

      if (!fields.result_confirmed_at) {
        collection.schema.addField(
          new SchemaField({
            id: fieldIds.confirmedAt,
            name: "result_confirmed_at",
            type: "date",
            required: false,
            options: {
              min: "",
              max: "",
            },
          }),
        );
      }

      dao.saveCollection(collection);
    };

    addResultFields(matchGamesCollection, {
      resultStatus: "mgresultstatus",
      homeScore: "mghomescorefld",
      awayScore: "mgawayscorefld",
      winnerSide: "mgwinnerfield",
      confirmedAt: "mgconfirmatfld",
    });

    addResultFields(individualMatchesCollection, {
      resultStatus: "imresultstatus",
      homeScore: "imhomescorefld",
      awayScore: "imawayscorefld",
      winnerSide: "imwinnerfield",
      confirmedAt: "imconfirmatfld",
    });

    /*
     * 기존 대진은 결과 미입력 상태로 보정합니다.
     */
    ["match_games", "individual_matches"].forEach((collectionName) => {
      const records = dao.findRecordsByFilter(
        collectionName,
        "id != ''",
        "",
        5000,
        0,
      );

      records.forEach((record) => {
        if (!record.getString("result_status")) {
          record.set("result_status", "pending");
          record.set("home_score", 0);
          record.set("away_score", 0);
          record.set("winner_side", "");
          record.set("result_confirmed_at", "");

          dao.saveRecord(record);
        }
      });
    });

    /*
     * 기존 레코드를 보정한 후 result_status를 필수 필드로 변경합니다.
     */
    matchGamesCollection.schema.getFieldByName("result_status").required = true;

    individualMatchesCollection.schema.getFieldByName(
      "result_status",
    ).required = true;

    dao.saveCollection(matchGamesCollection);
    dao.saveCollection(individualMatchesCollection);

    /*
     * 참가자 양측의 결과 제출 원본을 저장합니다.
     *
     * 팀 경기:
     *   target_type = team_game
     *   match_game 사용
     *
     * 개인 경기:
     *   target_type = individual_match
     *   individual_match 사용
     */
    const resultSubmissionsCollection = new Collection({
      id: "somoim_resub00",
      name: "match_result_submissions",
      type: "base",
      system: false,

      schema: [
        {
          id: "resulteventfld",
          name: "event",
          type: "relation",
          required: true,
          options: {
            collectionId: eventsCollection.id,
            cascadeDelete: true,
            minSelect: null,
            maxSelect: 1,
            displayFields: ["title"],
          },
        },
        {
          id: "resulttypefld",
          name: "target_type",
          type: "select",
          required: true,
          options: {
            maxSelect: 1,
            values: ["team_game", "individual_match"],
          },
        },
        {
          id: "resultgamefld",
          name: "match_game",
          type: "relation",
          required: false,
          options: {
            collectionId: matchGamesCollection.id,
            cascadeDelete: true,
            minSelect: null,
            maxSelect: 1,
            displayFields: ["sequence", "match_type"],
          },
        },
        {
          id: "resultindivfld",
          name: "individual_match",
          type: "relation",
          required: false,
          options: {
            collectionId: individualMatchesCollection.id,
            cascadeDelete: true,
            minSelect: null,
            maxSelect: 1,
            displayFields: ["round", "sort_order"],
          },
        },
        {
          id: "resultsidefld",
          name: "submitted_side",
          type: "select",
          required: true,
          options: {
            maxSelect: 1,
            values: ["home", "away"],
          },
        },
        {
          id: "resultsubmitby",
          name: "submitted_by",
          type: "relation",
          required: true,
          options: {
            collectionId: participantsCollection.id,
            cascadeDelete: false,
            minSelect: null,
            maxSelect: 1,
            displayFields: ["display_name"],
          },
        },

        /*
         * 점수는 항상 홈 기준으로 저장합니다.
         *
         * 예:
         * 홈 2 : 원정 1
         *
         * 원정 참가자가 제출하더라도
         * home_score=2, away_score=1 형식입니다.
         */
        {
          id: "resulthomescor",
          name: "home_score",
          type: "number",
          required: false,
          options: {
            min: 0,
            max: null,
            noDecimal: true,
          },
        },
        {
          id: "resultawayscor",
          name: "away_score",
          type: "number",
          required: false,
          options: {
            min: 0,
            max: null,
            noDecimal: true,
          },
        },
        {
          id: "resultversion",
          name: "version",
          type: "number",
          required: true,
          options: {
            min: 1,
            max: null,
            noDecimal: true,
          },
        },
      ],

      indexes: [
        "CREATE INDEX `idx_result_submissions_event` ON `match_result_submissions` (`event`)",
        "CREATE INDEX `idx_result_submissions_submitter` ON `match_result_submissions` (`submitted_by`)",
        "CREATE INDEX `idx_result_submissions_game` ON `match_result_submissions` (`match_game`)",
        "CREATE INDEX `idx_result_submissions_individual` ON `match_result_submissions` (`individual_match`)",

        /*
         * 각 경기에서 홈과 원정은 현재 제출값을 하나씩만 가집니다.
         * 재제출은 기존 레코드 update로 처리합니다.
         */
        "CREATE UNIQUE INDEX `idx_result_team_side` ON `match_result_submissions` (`match_game`, `submitted_side`) WHERE `match_game` != ''",

        "CREATE UNIQUE INDEX `idx_result_individual_side` ON `match_result_submissions` (`individual_match`, `submitted_side`) WHERE `individual_match` != ''",
      ],

      /*
       * 운영진도 일반 Record API로 결과를 직접 변경하지 않습니다.
       * 참가자와 운영진 모두 이후 만들 전용 API를 사용합니다.
       */
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
    });

    dao.saveCollection(resultSubmissionsCollection);
  },

  (db) => {
    const dao = new Dao(db);

    /*
     * relation이 있는 제출 컬렉션부터 삭제합니다.
     */
    try {
      const submissionsCollection = dao.findCollectionByNameOrId(
        "match_result_submissions",
      );

      dao.deleteCollection(submissionsCollection);
    } catch {
      // 이미 없는 경우 무시
    }

    const removeResultFields = (collectionName, fieldIds) => {
      const collection = dao.findCollectionByNameOrId(collectionName);
      const fields = collection.schema.asMap();

      if (fields.result_confirmed_at) {
        collection.schema.removeField(fieldIds.confirmedAt);
      }

      if (fields.winner_side) {
        collection.schema.removeField(fieldIds.winnerSide);
      }

      if (fields.away_score) {
        collection.schema.removeField(fieldIds.awayScore);
      }

      if (fields.home_score) {
        collection.schema.removeField(fieldIds.homeScore);
      }

      if (fields.result_status) {
        collection.schema.removeField(fieldIds.resultStatus);
      }

      dao.saveCollection(collection);
    };

    removeResultFields("match_games", {
      resultStatus: "mgresultstatus",
      homeScore: "mghomescorefld",
      awayScore: "mgawayscorefld",
      winnerSide: "mgwinnerfield",
      confirmedAt: "mgconfirmatfld",
    });

    removeResultFields("individual_matches", {
      resultStatus: "imresultstatus",
      homeScore: "imhomescorefld",
      awayScore: "imawayscorefld",
      winnerSide: "imwinnerfield",
      confirmedAt: "imconfirmatfld",
    });
  },
);
