/// <reference path="../pb_data/types.d.ts" />

migrate(
  (db) => {
    const dao = new Dao(db);

    const membersCollection = dao.findCollectionByNameOrId("members");
    const usersCollection = dao.findCollectionByNameOrId("users");
    const matchGamesCollection = dao.findCollectionByNameOrId("match_games");
    const individualMatchesCollection =
      dao.findCollectionByNameOrId("individual_matches");

    /*
     * 공식 단식 결과로 계산된 승급·강등 후보입니다.
     *
     * 후보는 자동으로 회원 부수를 바꾸지 않습니다.
     * 운영자가 승인한 경우에만 members.rank가 변경됩니다.
     */
    const candidatesCollection = new Collection({
      id: "somoim_rankcand",
      name: "ranking_adjustment_candidates",
      type: "base",
      system: false,

      schema: [
        {
          id: "rankcandmember",
          name: "member",
          type: "relation",
          required: true,
          options: {
            collectionId: membersCollection.id,
            cascadeDelete: false,
            minSelect: null,
            maxSelect: 1,
            displayFields: ["nickname", "rank"],
          },
        },
        {
          id: "rankcanddirect",
          name: "direction",
          type: "select",
          required: true,
          options: {
            maxSelect: 1,
            values: ["promotion", "demotion"],
          },
        },
        {
          id: "rankcandcurrent",
          name: "current_rank",
          type: "number",
          required: true,
          options: {
            min: 1,
            max: 99,
            noDecimal: true,
          },
        },
        {
          id: "rankcandpropose",
          name: "proposed_rank",
          type: "number",
          required: true,
          options: {
            min: 1,
            max: 99,
            noDecimal: true,
          },
        },
        {
          id: "rankcandstreak",
          name: "streak_count",
          type: "number",
          required: true,
          options: {
            min: 1,
            max: null,
            noDecimal: true,
          },
        },
        {
          id: "rankcandthresh",
          name: "threshold",
          type: "number",
          required: true,
          options: {
            min: 1,
            max: null,
            noDecimal: true,
          },
        },
        {
          id: "rankcandstatus",
          name: "status",
          type: "select",
          required: true,
          options: {
            maxSelect: 1,
            values: ["pending", "approved", "rejected", "obsolete"],
          },
        },
        {
          id: "rankcandsource",
          name: "source_type",
          type: "select",
          required: true,
          options: {
            maxSelect: 1,
            values: ["team_game", "individual_match"],
          },
        },
        {
          id: "rankcandgame",
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
          id: "rankcandindiv",
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
          id: "rankcandbasis",
          name: "basis_key",
          type: "text",
          required: true,
          options: {
            min: 1,
            max: 200,
            pattern: "",
          },
        },
        {
          id: "rankcandcalcat",
          name: "calculated_at",
          type: "date",
          required: true,
          options: {
            min: "",
            max: "",
          },
        },
        {
          id: "rankcandreview",
          name: "reviewed_by",
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
          id: "rankcandrevdate",
          name: "reviewed_at",
          type: "date",
          required: false,
          options: {
            min: "",
            max: "",
          },
        },
        {
          id: "rankcandnote",
          name: "review_note",
          type: "text",
          required: false,
          options: {
            min: null,
            max: 500,
            pattern: "",
          },
        },
        {
          id: "rankcandversion",
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
        "CREATE INDEX `idx_rank_candidates_member` ON `ranking_adjustment_candidates` (`member`)",
        "CREATE INDEX `idx_rank_candidates_status` ON `ranking_adjustment_candidates` (`status`)",
        "CREATE UNIQUE INDEX `idx_rank_candidates_basis` ON `ranking_adjustment_candidates` (`member`, `basis_key`)",
      ],

      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
    });

    dao.saveCollection(candidatesCollection);

    /*
     * 승인 또는 운영자의 직접 수정으로 실제 부수가 변경된 이력입니다.
     * 이 시점 이후의 공식 단식 결과부터 새 연승·연패를 계산합니다.
     */
    const historyCollection = new Collection({
      id: "somoim_rankhist",
      name: "member_rank_history",
      type: "base",
      system: false,

      schema: [
        {
          id: "rankhistmember",
          name: "member",
          type: "relation",
          required: true,
          options: {
            collectionId: membersCollection.id,
            cascadeDelete: false,
            minSelect: null,
            maxSelect: 1,
            displayFields: ["nickname", "rank"],
          },
        },
        {
          id: "rankhistcand",
          name: "candidate",
          type: "relation",
          required: false,
          options: {
            collectionId: candidatesCollection.id,
            cascadeDelete: false,
            minSelect: null,
            maxSelect: 1,
            displayFields: ["direction", "status"],
          },
        },
        {
          id: "rankhistprev",
          name: "previous_rank",
          type: "number",
          required: true,
          options: {
            min: 1,
            max: 99,
            noDecimal: true,
          },
        },
        {
          id: "rankhistnext",
          name: "new_rank",
          type: "number",
          required: true,
          options: {
            min: 1,
            max: 99,
            noDecimal: true,
          },
        },
        {
          id: "rankhistdirect",
          name: "direction",
          type: "select",
          required: true,
          options: {
            maxSelect: 1,
            values: ["promotion", "demotion", "manual"],
          },
        },
        {
          id: "rankhistreason",
          name: "reason",
          type: "text",
          required: true,
          options: {
            min: 1,
            max: 500,
            pattern: "",
          },
        },
        {
          id: "rankhistadmin",
          name: "approved_by",
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
          id: "rankhisteffect",
          name: "effective_at",
          type: "date",
          required: true,
          options: {
            min: "",
            max: "",
          },
        },
      ],

      indexes: [
        "CREATE INDEX `idx_rank_history_member` ON `member_rank_history` (`member`)",
        "CREATE INDEX `idx_rank_history_effective` ON `member_rank_history` (`effective_at`)",
      ],

      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
    });

    dao.saveCollection(historyCollection);

    /*
     * Phase 6에서 확정한 기본 강등 기준은 하위 부수 상대 4연패입니다.
     * 기존 기본값(3)인 경우만 4로 보정해 사용자가 정한 다른 값은 보존합니다.
     */
    const rankSettingRecords = dao.findRecordsByFilter(
      "rank_settings",
      "id != ''",
      "",
      100,
      0,
    );

    rankSettingRecords.forEach((record) => {
      if (record.getInt("demotion_threshold") === 3) {
        record.set("demotion_threshold", 4);
        dao.saveRecord(record);
      }
    });
  },

  (db) => {
    const dao = new Dao(db);

    try {
      dao.deleteCollection(
        dao.findCollectionByNameOrId("member_rank_history"),
      );
    } catch {
      // 이미 삭제된 경우 무시합니다.
    }

    try {
      dao.deleteCollection(
        dao.findCollectionByNameOrId("ranking_adjustment_candidates"),
      );
    } catch {
      // 이미 삭제된 경우 무시합니다.
    }
  },
);
