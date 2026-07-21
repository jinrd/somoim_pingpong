migrate(
  (db) => {
    const dao = new Dao(db);

    const eventsCollection = dao.findCollectionByNameOrId("events");

    /*
     * 회차별 전체 게임 설정
     */
    const gameSettingsCollection = new Collection({
      id: "somoim_gameset0",
      name: "event_game_settings",
      type: "base",
      system: false,

      schema: [
        {
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
          name: "competition_type",
          type: "select",
          required: true,
          options: {
            maxSelect: 1,
            values: ["team_league", "individual_singles"],
          },
        },

        // 개인 단식 리그에서는 0을 사용합니다.
        {
          name: "team_size",
          type: "number",
          required: true,
          options: {
            min: 0,
            max: null,
            noDecimal: true,
          },
        },
        {
          name: "auto_team_balance",
          type: "bool",
          required: true,
        },

        // 개인 단식 풀리그의 경기 세트 수
        {
          name: "individual_best_of",
          type: "number",
          required: true,
          options: {
            min: 1,
            max: null,
            noDecimal: true,
          },
        },
        {
          name: "individual_counts_for_ranking",
          type: "bool",
          required: true,
        },
        {
          name: "status",
          type: "select",
          required: true,
          options: {
            maxSelect: 1,
            values: ["draft", "confirmed"],
          },
        },
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
        "CREATE UNIQUE INDEX `idx_event_game_settings_event` ON `event_game_settings` (`event`)",
        "CREATE INDEX `idx_event_game_settings_type` ON `event_game_settings` (`competition_type`)",
      ],

      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
    });

    dao.saveCollection(gameSettingsCollection);

    /*
     * 팀 대결에서 사용할 세부 경기 구성
     */
    const matchFormatsCollection = new Collection({
      id: "somoim_gamefmt0",
      name: "event_match_formats",
      type: "base",
      system: false,

      schema: [
        {
          name: "game_setting",
          type: "relation",
          required: true,
          options: {
            collectionId: gameSettingsCollection.id,
            cascadeDelete: true,
            minSelect: null,
            maxSelect: 1,
            displayFields: ["competition_type"],
          },
        },
        {
          name: "sequence",
          type: "number",
          required: true,
          options: {
            min: 1,
            max: null,
            noDecimal: true,
          },
        },
        {
          name: "match_type",
          type: "select",
          required: true,
          options: {
            maxSelect: 1,
            values: ["singles", "doubles"],
          },
        },

        // 3이면 3판 2선승,
        // 5이면 5판 3선승입니다.
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
        {
          name: "counts_for_ranking",
          type: "bool",
          required: true,
        },
      ],

      indexes: [
        "CREATE INDEX `idx_event_match_formats_setting` ON `event_match_formats` (`game_setting`)",
        "CREATE UNIQUE INDEX `idx_event_match_formats_sequence` ON `event_match_formats` (`game_setting`, `sequence`)",
      ],

      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
    });

    dao.saveCollection(matchFormatsCollection);
  },
  (db) => {
    const dao = new Dao(db);

    // relation이 있는 자식 컬렉션부터 삭제합니다.
    try {
      const matchFormats = dao.findCollectionByNameOrId("event_match_formats");

      dao.deleteCollection(matchFormats);
    } catch {
      // 이미 없는 경우 무시
    }

    try {
      const gameSettings = dao.findCollectionByNameOrId("event_game_settings");

      dao.deleteCollection(gameSettings);
    } catch {
      // 이미 없는 경우 무시
    }
  },
);
