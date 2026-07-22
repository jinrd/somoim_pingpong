/// <reference path="../pb_data/types.d.ts" />

migrate(
  (db) => {
    const dao = new Dao(db);

    const events = dao.findCollectionByNameOrId("events");
    const gameSettings = dao.findCollectionByNameOrId("event_game_settings");
    const formations = dao.findCollectionByNameOrId("team_formations");
    const teams = dao.findCollectionByNameOrId("teams");
    const participants = dao.findCollectionByNameOrId("event_participants");

    /*
     * 팀 대진
     *
     * 예:
     * A팀 vs B팀
     * A팀 vs E팀
     */
    const teamMatches = new Collection({
      id: "somoim_tmatch00",
      name: "team_matches",
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
          name: "formation",
          type: "relation",
          required: true,
          options: {
            collectionId: formations.id,
            cascadeDelete: true,
            minSelect: null,
            maxSelect: 1,
            displayFields: ["status"],
          },
        },
        {
          name: "home_team",
          type: "relation",
          required: true,
          options: {
            collectionId: teams.id,
            cascadeDelete: true,
            minSelect: null,
            maxSelect: 1,
            displayFields: ["name"],
          },
        },
        {
          name: "away_team",
          type: "relation",
          required: true,
          options: {
            collectionId: teams.id,
            cascadeDelete: true,
            minSelect: null,
            maxSelect: 1,
            displayFields: ["name"],
          },
        },

        /*
         * 두 팀 ID를 정렬해서 만든 값입니다.
         * 예: teamAId:teamBId
         *
         * 동일한 두 팀의 중복 대진을 막는 데 사용합니다.
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
         * 대진 생성 시점의 단식/복식 구성을 JSON 문자열로 저장합니다.
         * 이후 게임 설정을 수정해도 이미 만든 대진은 변경되지 않습니다.
         */
        {
          name: "format_snapshot",
          type: "text",
          required: true,
          options: {
            min: 2,
            max: 10000,
            pattern: "",
          },
        },
        {
          name: "status",
          type: "select",
          required: true,
          options: {
            maxSelect: 1,
            values: [
              "scheduled",
              "ready",
              "in_progress",
              "completed",
              "cancelled",
            ],
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
        "CREATE INDEX `idx_team_matches_event` ON `team_matches` (`event`)",
        "CREATE INDEX `idx_team_matches_formation` ON `team_matches` (`formation`)",
        "CREATE UNIQUE INDEX `idx_team_matches_pair` ON `team_matches` (`formation`, `pair_key`)",
        "CREATE UNIQUE INDEX `idx_team_matches_order` ON `team_matches` (`formation`, `sort_order`)",
      ],

      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",

      // 대진은 이후 만들 전용 API에서만 생성·수정합니다.
      createRule: null,
      updateRule: null,
      deleteRule: null,
    });

    dao.saveCollection(teamMatches);

    /*
     * 한 팀 대진 안의 세부 경기
     *
     * 예:
     * 1경기 단식
     * 2경기 단식
     * 3경기 복식
     */
    const matchGames = new Collection({
      id: "somoim_mgames00",
      name: "match_games",
      type: "base",
      system: false,

      schema: [
        {
          name: "team_match",
          type: "relation",
          required: true,
          options: {
            collectionId: teamMatches.id,
            cascadeDelete: true,
            minSelect: null,
            maxSelect: 1,
            displayFields: ["round", "sort_order"],
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

        // false도 정상값이므로 required를 false로 둡니다.
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
        "CREATE INDEX `idx_match_games_match` ON `match_games` (`team_match`)",
        "CREATE UNIQUE INDEX `idx_match_games_sequence` ON `match_games` (`team_match`, `sequence`)",
      ],

      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: null,
      updateRule: null,
      deleteRule: null,
    });

    dao.saveCollection(matchGames);

    /*
     * 팀별 라인업 상태
     *
     * A팀과 B팀은 서로 독립적으로 작성하고 확정합니다.
     * 한 team_match에는 두 개의 lineup 레코드가 만들어집니다.
     */
    const teamMatchLineups = new Collection({
      id: "somoim_lineups0",
      name: "team_match_lineups",
      type: "base",
      system: false,

      schema: [
        {
          name: "team_match",
          type: "relation",
          required: true,
          options: {
            collectionId: teamMatches.id,
            cascadeDelete: true,
            minSelect: null,
            maxSelect: 1,
            displayFields: ["round", "sort_order"],
          },
        },
        {
          name: "team",
          type: "relation",
          required: true,
          options: {
            collectionId: teams.id,
            cascadeDelete: true,
            minSelect: null,
            maxSelect: 1,
            displayFields: ["name"],
          },
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

        /*
         * 라인업을 마지막으로 확정한 참가자입니다.
         * 운영자가 아니라 해당 팀 참가자를 저장합니다.
         */
        {
          name: "confirmed_by",
          type: "relation",
          required: false,
          options: {
            collectionId: participants.id,
            cascadeDelete: false,
            minSelect: null,
            maxSelect: 1,
            displayFields: ["display_name"],
          },
        },
        {
          name: "confirmed_at",
          type: "date",
          required: false,
          options: {
            min: "",
            max: "",
          },
        },

        /*
         * 같은 팀 참가자 두 명이 동시에 수정할 때
         * 오래된 저장 요청을 거절하기 위한 버전입니다.
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
        "CREATE INDEX `idx_lineups_match` ON `team_match_lineups` (`team_match`)",
        "CREATE INDEX `idx_lineups_team` ON `team_match_lineups` (`team`)",
        "CREATE UNIQUE INDEX `idx_lineups_match_team` ON `team_match_lineups` (`team_match`, `team`)",
      ],

      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",

      // 참가자는 전용 공개 API로만 접근합니다.
      createRule: null,
      updateRule: null,
      deleteRule: null,
    });

    dao.saveCollection(teamMatchLineups);

    /*
     * 세부 경기별 출전 선수
     *
     * 단식: position 1 한 명
     * 복식: position 1, 2 두 명
     */
    const matchGamePlayers = new Collection({
      id: "somoim_players0",
      name: "match_game_players",
      type: "base",
      system: false,

      schema: [
        {
          name: "lineup",
          type: "relation",
          required: true,
          options: {
            collectionId: teamMatchLineups.id,
            cascadeDelete: true,
            minSelect: null,
            maxSelect: 1,
            displayFields: ["status"],
          },
        },
        {
          name: "match_game",
          type: "relation",
          required: true,
          options: {
            collectionId: matchGames.id,
            cascadeDelete: true,
            minSelect: null,
            maxSelect: 1,
            displayFields: ["sequence", "match_type"],
          },
        },
        {
          name: "participant",
          type: "relation",
          required: true,
          options: {
            collectionId: participants.id,
            cascadeDelete: false,
            minSelect: null,
            maxSelect: 1,
            displayFields: ["display_name"],
          },
        },
        {
          name: "position",
          type: "number",
          required: true,
          options: {
            min: 1,
            max: 2,
            noDecimal: true,
          },
        },
      ],

      indexes: [
        "CREATE INDEX `idx_players_lineup` ON `match_game_players` (`lineup`)",
        "CREATE INDEX `idx_players_game` ON `match_game_players` (`match_game`)",

        // 한 라인업에서 같은 세부 경기의 같은 자리에 한 명만 배정
        "CREATE UNIQUE INDEX `idx_players_position` ON `match_game_players` (`lineup`, `match_game`, `position`)",

        // 같은 팀의 동일 세부 경기에 한 선수가 중복으로 들어가는 것 방지
        "CREATE UNIQUE INDEX `idx_players_participant` ON `match_game_players` (`lineup`, `match_game`, `participant`)",
      ],

      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: null,
      updateRule: null,
      deleteRule: null,
    });

    dao.saveCollection(matchGamePlayers);
  },

  (db) => {
    const dao = new Dao(db);

    // relation의 가장 아래쪽 컬렉션부터 삭제해야 합니다.
    const matchGamePlayers = dao.findCollectionByNameOrId("match_game_players");
    dao.deleteCollection(matchGamePlayers);

    const teamMatchLineups = dao.findCollectionByNameOrId("team_match_lineups");
    dao.deleteCollection(teamMatchLineups);

    const matchGames = dao.findCollectionByNameOrId("match_games");
    dao.deleteCollection(matchGames);

    const teamMatches = dao.findCollectionByNameOrId("team_matches");
    dao.deleteCollection(teamMatches);
  },
);
