/// <reference path="../pb_data/types.d.ts" />

migrate(
  (db) => {
    const dao = new Dao(db);

    const eventsCollection = dao.findCollectionByNameOrId("events");
    const participantsCollection =
      dao.findCollectionByNameOrId("event_participants");
    const usersCollection = dao.findCollectionByNameOrId("users");
    const teamMatchesCollection = dao.findCollectionByNameOrId("team_matches");
    const matchGamesCollection = dao.findCollectionByNameOrId("match_games");
    const individualMatchesCollection =
      dao.findCollectionByNameOrId("individual_matches");

    const historyCollection = new Collection({
      id: "somoim_reshist0",
      name: "match_result_history",
      type: "base",
      system: false,

      schema: [
        {
          id: "hist_event_fld",
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
          id: "hist_type_fld",
          name: "target_type",
          type: "select",
          required: true,
          options: {
            maxSelect: 1,
            values: ["team_match", "team_game", "individual_match"],
          },
        },
        {
          id: "hist_team_fld",
          name: "team_match",
          type: "relation",
          required: false,
          options: {
            collectionId: teamMatchesCollection.id,
            cascadeDelete: false,
            minSelect: null,
            maxSelect: 1,
            displayFields: ["round", "sort_order"],
          },
        },
        {
          id: "hist_game_fld",
          name: "match_game",
          type: "relation",
          required: false,
          options: {
            collectionId: matchGamesCollection.id,
            cascadeDelete: false,
            minSelect: null,
            maxSelect: 1,
            displayFields: ["sequence", "match_type"],
          },
        },
        {
          id: "hist_indiv_fld",
          name: "individual_match",
          type: "relation",
          required: false,
          options: {
            collectionId: individualMatchesCollection.id,
            cascadeDelete: false,
            minSelect: null,
            maxSelect: 1,
            displayFields: ["round", "sort_order"],
          },
        },
        {
          id: "hist_action_fld",
          name: "action",
          type: "select",
          required: true,
          options: {
            maxSelect: 1,
            values: [
              "submitted",
              "updated",
              "confirmed",
              "disputed",
              "cancelled",
            ],
          },
        },
        {
          id: "hist_requestid",
          name: "request_id",
          type: "text",
          required: true,
          options: {
            min: 1,
            max: 100,
            pattern: "",
          },
        },
        {
          id: "hist_actor_fld",
          name: "actor_type",
          type: "select",
          required: true,
          options: {
            maxSelect: 1,
            values: ["participant", "admin", "system"],
          },
        },
        {
          id: "hist_part_fld",
          name: "actor_participant",
          type: "relation",
          required: false,
          options: {
            collectionId: participantsCollection.id,
            cascadeDelete: false,
            minSelect: null,
            maxSelect: 1,
            displayFields: ["display_name"],
          },
        },
        {
          id: "hist_admin_fld",
          name: "actor_admin",
          type: "relation",
          required: false,
          options: {
            collectionId: usersCollection.id,
            cascadeDelete: false,
            minSelect: null,
            maxSelect: 1,
            displayFields: ["email"],
          },
        },
        {
          id: "hist_name_fld",
          name: "actor_name",
          type: "text",
          required: true,
          options: {
            min: 1,
            max: 200,
            pattern: "",
          },
        },
        {
          id: "hist_side_fld",
          name: "submitted_side",
          type: "select",
          required: false,
          options: {
            maxSelect: 1,
            values: ["home", "away"],
          },
        },
        {
          id: "hist_beforefld",
          name: "before_data",
          type: "text",
          required: false,
          options: {
            min: null,
            max: 10000,
            pattern: "",
          },
        },
        {
          id: "hist_after_fld",
          name: "after_data",
          type: "text",
          required: false,
          options: {
            min: null,
            max: 10000,
            pattern: "",
          },
        },
        {
          id: "hist_reason_fld",
          name: "reason",
          type: "text",
          required: false,
          options: {
            min: null,
            max: 500,
            pattern: "",
          },
        },
      ],

      indexes: [
        "CREATE UNIQUE INDEX `idx_result_history_request` ON `match_result_history` (`request_id`)",
        "CREATE INDEX `idx_result_history_event` ON `match_result_history` (`event`)",
        "CREATE INDEX `idx_result_history_team` ON `match_result_history` (`team_match`)",
        "CREATE INDEX `idx_result_history_game` ON `match_result_history` (`match_game`)",
        "CREATE INDEX `idx_result_history_individual` ON `match_result_history` (`individual_match`)",
      ],

      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
    });

    dao.saveCollection(historyCollection);
  },

  (db) => {
    const dao = new Dao(db);

    try {
      const collection = dao.findCollectionByNameOrId("match_result_history");

      dao.deleteCollection(collection);
    } catch {
      // 이미 삭제된 경우 무시합니다.
    }
  },
);
