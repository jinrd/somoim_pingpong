migrate(
  (db) => {
    const dao = new Dao(db);

    const usersCollection = dao.findCollectionByNameOrId("users");
    const membersCollection = dao.findCollectionByNameOrId("members");

    // =========================================================
    // events
    // =========================================================

    const eventsCollection = new Collection({
      id: "somoim_events00",
      name: "events",
      type: "base",
      system: false,

      schema: [
        {
          name: "title",
          type: "text",
          required: true,
          options: {
            min: 1,
            max: 150,
            pattern: "",
          },
        },
        {
          name: "event_date",
          type: "date",
          required: true,
          options: {
            min: "",
            max: "",
          },
        },
        {
          name: "status",
          type: "select",
          required: true,
          options: {
            maxSelect: 1,
            values: ["draft", "active", "completed", "archived"],
          },
        },
        {
          name: "notice",
          type: "text",
          required: false,
          options: {
            min: null,
            max: 3000,
            pattern: "",
          },
        },

        // Phase 5 공개 링크 기능을 위한 사전 필드
        {
          name: "public_token_hash",
          type: "text",
          required: false,
          options: {
            min: null,
            max: 128,
            pattern: "",
          },
        },
        {
          name: "public_access_enabled",
          type: "bool",
          required: false,
        },
        {
          name: "public_expires_at",
          type: "date",
          required: false,
          options: {
            min: "",
            max: "",
          },
        },

        // 회차를 만든 운영진
        {
          name: "created_by",
          type: "relation",
          required: true,
          options: {
            collectionId: usersCollection.id,
            cascadeDelete: false,
            minSelect: null,
            maxSelect: 1,
            displayFields: ["email"],
          },
        },

        // 동시 수정 감지를 위한 버전
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
        "CREATE INDEX `idx_events_event_date` ON `events` (`event_date`)",
        "CREATE INDEX `idx_events_status` ON `events` (`status`)",
        "CREATE UNIQUE INDEX `idx_events_public_token_hash` ON `events` (`public_token_hash`) WHERE `public_token_hash` != ''",
      ],

      // 운영진 계정만 접근 가능
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",

      // 회차 물리 삭제는 막고 archived 상태로 보관
      deleteRule: null,
    });

    dao.saveCollection(eventsCollection);

    // =========================================================
    // event_participants
    // =========================================================

    const participantsCollection = new Collection({
      id: "somoim_evtparts",
      name: "event_participants",
      type: "base",
      system: false,

      schema: [
        {
          name: "event",
          type: "relation",
          required: true,
          options: {
            collectionId: eventsCollection.id,

            // 회차가 제거되면 참가자 데이터도 제거
            // 현재 일반 API에서는 회차 삭제가 막혀 있음
            cascadeDelete: true,

            minSelect: null,
            maxSelect: 1,
            displayFields: ["title"],
          },
        },

        {
          name: "participant_type",
          type: "select",
          required: true,
          options: {
            maxSelect: 1,
            values: ["member", "guest"],
          },
        },

        // 기존 회원이면 relation을 사용
        {
          name: "member",
          type: "relation",
          required: false,
          options: {
            collectionId: membersCollection.id,
            cascadeDelete: false,
            minSelect: null,
            maxSelect: 1,
            displayFields: ["nickname", "name"],
          },
        },

        // 일회성 게스트
        {
          name: "guest_name",
          type: "text",
          required: false,
          options: {
            min: null,
            max: 100,
            pattern: "",
          },
        },

        // 당시 공개 화면에 사용할 표시 이름 snapshot
        {
          name: "display_name",
          type: "text",
          required: true,
          options: {
            min: 1,
            max: 100,
            pattern: "",
          },
        },

        // 당시 부수 snapshot
        {
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
          name: "game_participation_status",
          type: "select",
          required: true,
          options: {
            maxSelect: 1,
            values: ["undecided", "playing", "not_playing"],
          },
        },

        // 나중에 참가자가 본인의 참가 여부를 변경할 때 사용
        {
          name: "participation_token_hash",
          type: "text",
          required: false,
          options: {
            min: null,
            max: 128,
            pattern: "",
          },
        },

        {
          name: "participation_responded_at",
          type: "date",
          required: false,
          options: {
            min: "",
            max: "",
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
        "CREATE INDEX `idx_event_participants_event` ON `event_participants` (`event`)",
        "CREATE INDEX `idx_event_participants_member` ON `event_participants` (`member`)",
        "CREATE INDEX `idx_event_participants_game_status` ON `event_participants` (`game_participation_status`)",

        // 같은 회원이 같은 회차에 중복 추가되는 것을 방지
        "CREATE UNIQUE INDEX `idx_event_participants_event_member` ON `event_participants` (`event`, `member`) WHERE `member` != ''",

        // 참가자 개인 토큰 중복 방지
        "CREATE UNIQUE INDEX `idx_event_participants_token` ON `event_participants` (`participation_token_hash`) WHERE `participation_token_hash` != ''",
      ],

      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",

      // 참석자 제거는 필요하므로 운영진에게 허용
      deleteRule: "@request.auth.id != ''",
    });

    dao.saveCollection(participantsCollection);
  },

  // ===========================================================
  // rollback
  // ===========================================================

  (db) => {
    const dao = new Dao(db);

    // relation이 있는 자식 Collection부터 제거
    try {
      const participantsCollection =
        dao.findCollectionByNameOrId("event_participants");

      dao.deleteCollection(participantsCollection);
    } catch {
      // 이미 없는 경우 무시
    }

    try {
      const eventsCollection = dao.findCollectionByNameOrId("events");

      dao.deleteCollection(eventsCollection);
    } catch {
      // 이미 없는 경우 무시
    }
  },
);
