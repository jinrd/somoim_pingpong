/// <reference path="../pb_data/types.d.ts" />

migrate(
  (db) => {
    const dao = new Dao(db);

    const events = dao.findCollectionByNameOrId("events");
    const gameSettings = dao.findCollectionByNameOrId("event_game_settings");
    const participants = dao.findCollectionByNameOrId("event_participants");

    /*
     * 개인 단식 대진
     *
     * 예:
     * A참가자 vs B참가자
     */
    const individualMatches = new Collection({
      id: "somoim_imatch00",
      name: "individual_matches",
      type: "base",
      system: false,
      schema: [
        {
          name: "event",
          type: "relation",
          required: true,
          options: {
            collectionId: events.id,
            cascadeDelete: true,
            minSelect: null,
            maxSelect: 1,
            displayFields: ["title"],
          },
        },
        {
          name: "game_setting",
          type: "relation",
          required: true,
          options: {
            collectionId: gameSettings.id,
            cascadeDelete: true,
            minSelect: null,
            maxSelect: 1,
            displayFields: ["competition_type"],
          },
        },
        {
          name: "home_participant",
          type: "relation",
          required: true,
          options: {
            collectionId: participants.id,
            cascadeDelete: true,
            minSelect: null,
            maxSelect: 1,
            displayFields: ["display_name"],
          },
        },
        {
          name: "away_participant",
          type: "relation",
          required: true,
          options: {
            collectionId: participants.id,
            cascadeDelete: true,
            minSelect: null,
            maxSelect: 1,
            displayFields: ["display_name"],
          },
        },
        /*
         * 두 참가자 ID를 정렬해서 만든 값입니다.
         * 예: participantAId:participantBId
         *
         * 동일한 두 참가자의 중복 대진을 막는 데 사용합니다.
         */
        {
          name: "pair_key",
          type: "text",
          required: true,
          options: {
            min: 3,
            max: 100,
            pattern: "",
          },
        },
        {
          name: "round",
          type: "number",
          required: true,
          options: {
            min: 1,
            max: null,
            noDecimal: true,
          },
        },
        {
          name: "sort_order",
          type: "number",
          required: true,
          options: {
            min: 1,
            max: null,
            noDecimal: true,
          },
        },
        /*
         * 해당 대진의 세트 수 (예: 3판 2선승이면 3)
         */
        {
          name: "best_of",
          type: "number",
          required: true,
          options: {
            min: 1,
            max: null,
            noDecimal: true,
          },
        },
        /*
         * 공식 부수 산정(랭킹전) 포함 여부
         * false도 정상값이므로 required를 false로 둡니다.
         */
        {
          name: "counts_for_ranking",
          type: "bool",
          required: false,
        },
        {
          name: "status",
          type: "select",
          required: true,
          options: {
            maxSelect: 1,
            values: ["scheduled", "in_progress", "completed", "cancelled"],
          },
        },
        /*
         * 동시 저장 요청을 거절하기 위한 버전 필드입니다.
         */
        {
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
        "CREATE INDEX `idx_indiv_matches_event` ON `individual_matches` (`event`)",
        "CREATE INDEX `idx_indiv_matches_setting` ON `individual_matches` (`game_setting`)",
        "CREATE UNIQUE INDEX `idx_indiv_matches_pair` ON `individual_matches` (`game_setting`, `pair_key`)",
        "CREATE UNIQUE INDEX `idx_indiv_matches_order` ON `individual_matches` (`game_setting`, `sort_order`)",
      ],
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      // 대진은 이후 만들 전용 API에서만 생성·수정합니다.
      createRule: null,
      updateRule: null,
      deleteRule: null,
    });
    dao.saveCollection(individualMatches);
  },
  (db) => {
    const dao = new Dao(db);
    const individualMatches =
      dao.findCollectionByNameOrId("individual_matches");
    dao.deleteCollection(individualMatches);
  },
);
