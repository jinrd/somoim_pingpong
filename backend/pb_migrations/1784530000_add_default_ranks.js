migrate((db) => {
  const dao = new Dao(db);
  const rankSettings = dao.findCollectionByNameOrId("rank_settings");

  rankSettings.schema.addField(new SchemaField({
    id: "defmemberrank",
    name: "default_member_rank",
    type: "number",
    required: false,
    options: {
      min: 1,
      max: 99,
      noDecimal: true,
    },
  }));

  rankSettings.schema.addField(new SchemaField({
    id: "defguestrank",
    name: "default_guest_rank",
    type: "number",
    required: false,
    options: {
      min: 1,
      max: 99,
      noDecimal: true,
    },
  }));

  dao.saveCollection(rankSettings);

  const records = dao.findRecordsByFilter(
    "rank_settings",
    "id != ''",
    "created",
    100,
    0,
  );

  if (records.length === 0) {
    const initialSettings = new Record(rankSettings);

    initialSettings.set("min_rank", 1);
    initialSettings.set("max_rank", 8);
    initialSettings.set("default_member_rank", 8);
    initialSettings.set("default_guest_rank", 8);
    initialSettings.set("promotion_threshold", 3);
    initialSettings.set("demotion_threshold", 3);

    dao.saveRecord(initialSettings);
  } else {
    for (const record of records) {
      const minRank = record.getInt("min_rank");
      const maxRank = record.getInt("max_rank");
      const fallbackRank = Math.min(
        Math.max(8, minRank),
        maxRank,
      );

      record.set("default_member_rank", fallbackRank);
      record.set("default_guest_rank", fallbackRank);
      dao.saveRecord(record);
    }
  }

  const memberDefaultField = rankSettings.schema
    .getFieldByName("default_member_rank");
  const guestDefaultField = rankSettings.schema
    .getFieldByName("default_guest_rank");

  memberDefaultField.required = true;
  guestDefaultField.required = true;
  dao.saveCollection(rankSettings);
}, (db) => {
  const dao = new Dao(db);
  const rankSettings = dao.findCollectionByNameOrId("rank_settings");

  rankSettings.schema.removeField("defmemberrank");
  rankSettings.schema.removeField("defguestrank");
  dao.saveCollection(rankSettings);
});
