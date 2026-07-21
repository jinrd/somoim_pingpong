// backend/pb_migrations/1700000000_init_members.js
migrate(
  (db) => {
    const dao = new Dao(db);

    // 1. members (회원) 컬렉션 생성
    const members = new Collection({
      id: "somoim_members00",
      name: "members",
      type: "base",
      system: false,
      schema: [
        {
          name: "name",
          type: "text",
          required: true,
          options: { min: 1, max: 100 },
        },
        {
          name: "nickname",
          type: "text",
          required: true,
          options: { min: 1, max: 100 },
        },
        {
          name: "gender",
          type: "select",
          required: false,
          options: { maxSelect: 1, values: ["M", "F"] },
        }, // 성별 추가
        { name: "phone", type: "text", required: false }, // 연락처 추가
        { name: "rank", type: "number", required: true }, // 부수 (예: 1~8)
        {
          name: "status",
          type: "select",
          required: true,
          options: { maxSelect: 1, values: ["active", "inactive"] },
        },
        { name: "memo", type: "text", required: false },
        { name: "joined_at", type: "date", required: false },
      ],
      // API Rules: 운영진(로그인한 사용자)만 읽고 쓸 수 있음
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: null, // 실제 삭제 방지 (상태만 inactive로 변경하도록)
    });
    dao.saveCollection(members);

    // 2. rank_settings (부수 승강 설정) 컬렉션 생성
    const rankSettings = new Collection({
      id: "somoim_rank_set0",
      name: "rank_settings",
      type: "base",
      system: false,
      schema: [
        { name: "min_rank", type: "number", required: true }, // 최소 부수 (예: 1)
        { name: "max_rank", type: "number", required: true }, // 최대 부수 (예: 8)
        { name: "promotion_threshold", type: "number", required: true }, // 승급 조건 승수 (예: 3)
        { name: "demotion_threshold", type: "number", required: true }, // 강등 조건 패수 (예: 3)
      ],
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: null,
    });
    dao.saveCollection(rankSettings);
  },
  (db) => {
    const dao = new Dao(db);
    try {
      dao.deleteCollection(dao.findCollectionByNameOrId("members"));
    } catch (e) {}
    try {
      dao.deleteCollection(dao.findCollectionByNameOrId("rank_settings"));
    } catch (e) {}
  },
);
