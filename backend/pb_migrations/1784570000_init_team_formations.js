/// <reference path="../pb_data/types.d.ts" />

migrate(
  (db) => {
    const dao = new Dao(db);

    const eventsCollection = dao.findCollectionByNameOrId("events");
    const gameSettingsCollection = dao.findCollectionByNameOrId(
      "event_game_settings",
    );
    const participantsCollection =
      dao.findCollectionByNameOrId("event_participants");

    /*
     * 회차별 팀 편성 정보
     */
    const formationsCollection = new Collection({
      id: "somoim_teamform",
      name: "team_formations",
      type: "base",
      system: false,

      schema: [
        {
          id: "formationevent",
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
          id: "formgamesetting",
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
          id: "formationmethod",
          name: "method",
          type: "select",
          required: true,
          options: {
            maxSelect: 1,
            values: ["balanced", "random"],
          },
        },
        {
          id: "formationstatus",
          name: "status",
          type: "select",
          required: true,
          options: {
            maxSelect: 1,
            values: ["draft", "confirmed"],
          },
        },
        {
          id: "qualityscorefld",
          name: "quality_score",
          type: "number",

          // 품질 계산 전 0도 저장할 수 있어야 합니다.
          required: false,

          options: {
            min: 0,
            max: 100,
            noDecimal: false,
          },
        },
        {
          id: "formationversn",
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
        "CREATE UNIQUE INDEX `idx_team_formations_game_setting` ON `team_formations` (`game_setting`)",
        "CREATE INDEX `idx_team_formations_event` ON `team_formations` (`event`)",
      ],

      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
    });

    dao.saveCollection(formationsCollection);

    /*
     * 편성에 포함된 팀
     */
    const teamsCollection = new Collection({
      id: "somoim_teams000",
      name: "teams",
      type: "base",
      system: false,

      schema: [
        {
          id: "teamformation",
          name: "formation",
          type: "relation",
          required: true,
          options: {
            collectionId: formationsCollection.id,
            cascadeDelete: true,
            minSelect: null,
            maxSelect: 1,
            displayFields: ["status"],
          },
        },
        {
          id: "teamevent",
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
          id: "teamname",
          name: "name",
          type: "text",
          required: true,
          options: {
            min: 1,
            max: 30,
            pattern: "",
          },
        },
        {
          id: "teamsortorder",
          name: "sort_order",
          type: "number",
          required: true,
          options: {
            min: 1,
            max: null,
            noDecimal: true,
          },
        },
        {
          id: "teamavgrank",
          name: "average_rank",
          type: "number",

          // 아직 팀원이 없는 임시 팀은 0일 수 있습니다.
          required: false,

          options: {
            min: 0,
            max: null,
            noDecimal: false,
          },
        },
        {
          id: "teamversion",
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
        "CREATE INDEX `idx_teams_event` ON `teams` (`event`)",
        "CREATE INDEX `idx_teams_formation` ON `teams` (`formation`)",
        "CREATE UNIQUE INDEX `idx_teams_name` ON `teams` (`formation`, `name`)",
        "CREATE UNIQUE INDEX `idx_teams_sort_order` ON `teams` (`formation`, `sort_order`)",
      ],

      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
    });

    dao.saveCollection(teamsCollection);

    /*
     * 팀에 배치된 참가자
     */
    const teamMembersCollection = new Collection({
      id: "somoim_teammemb",
      name: "team_members",
      type: "base",
      system: false,

      schema: [
        {
          id: "memberformation",
          name: "formation",
          type: "relation",
          required: true,
          options: {
            collectionId: formationsCollection.id,
            cascadeDelete: true,
            minSelect: null,
            maxSelect: 1,
            displayFields: ["status"],
          },
        },
        {
          id: "memberevent",
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
          id: "memberteam",
          name: "team",
          type: "relation",
          required: true,
          options: {
            collectionId: teamsCollection.id,
            cascadeDelete: true,
            minSelect: null,
            maxSelect: 1,
            displayFields: ["name"],
          },
        },
        {
          id: "memberparticpt",
          name: "participant",
          type: "relation",
          required: true,
          options: {
            collectionId: participantsCollection.id,
            cascadeDelete: true,
            minSelect: null,
            maxSelect: 1,
            displayFields: ["display_name"],
          },
        },
        {
          id: "memberranksnap",
          name: "rank_snapshot",
          type: "number",
          required: true,
          options: {
            min: 1,
            max: 99,
            noDecimal: true,
          },
        },
        {
          id: "membersortorder",
          name: "sort_order",
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
        "CREATE INDEX `idx_team_members_event` ON `team_members` (`event`)",
        "CREATE INDEX `idx_team_members_team` ON `team_members` (`team`)",
        "CREATE UNIQUE INDEX `idx_team_members_participant` ON `team_members` (`formation`, `participant`)",
        "CREATE UNIQUE INDEX `idx_team_members_sort_order` ON `team_members` (`team`, `sort_order`)",
      ],

      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
    });

    dao.saveCollection(teamMembersCollection);
  },

  (db) => {
    const dao = new Dao(db);

    const teamMembersCollection = dao.findCollectionByNameOrId("team_members");
    dao.deleteCollection(teamMembersCollection);

    const teamsCollection = dao.findCollectionByNameOrId("teams");
    dao.deleteCollection(teamsCollection);

    const formationsCollection =
      dao.findCollectionByNameOrId("team_formations");
    dao.deleteCollection(formationsCollection);
  },
);
