migrate(
  (db) => {
    const dao = new Dao(db);
    const members = dao.findCollectionByNameOrId("members");
    const fields = members.schema.asMap();

    // 기존 개발 DB에는 관리자 UI에서 수동 추가됐지만 초기 migration에는 없던 필드입니다.
    if (!fields.gender) {
      members.schema.addField(
        new SchemaField({
          id: "mbrgendr",
          name: "gender",
          type: "select",
          required: false,
          options: { maxSelect: 1, values: ["M", "F"] },
        }),
      );
    }

    if (!fields.phone) {
      members.schema.addField(
        new SchemaField({
          id: "mbrphone",
          name: "phone",
          type: "text",
          required: false,
          options: { min: null, max: 30, pattern: "" },
        }),
      );
    }

    const rankField = members.schema.getFieldByName("rank");
    rankField.options = { min: 1, max: 99, noDecimal: true };

    dao.saveCollection(members);
  },
  (db) => {
    const dao = new Dao(db);
    const members = dao.findCollectionByNameOrId("members");

    // 이 migration이 직접 생성한 필드만 제거합니다.
    members.schema.removeField("mbrgendr");
    members.schema.removeField("mbrphone");

    const rankField = members.schema.getFieldByName("rank");
    rankField.options = { min: null, max: null, noDecimal: false };

    dao.saveCollection(members);
  },
);
