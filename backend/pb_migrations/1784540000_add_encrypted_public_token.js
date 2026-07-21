migrate(
  (db) => {
    const dao = new Dao(db);

    const events = dao.findCollectionByNameOrId("events");

    events.schema.addField(
      new SchemaField({
        id: "pubtokencrypt",
        name: "public_token_encrypted",
        type: "text",
        required: false,
        options: {
          min: null,
          max: 1000,
          pattern: "",
        },
      }),
    );

    dao.saveCollection(events);
  },
  (db) => {
    const dao = new Dao(db);

    const events = dao.findCollectionByNameOrId("events");

    events.schema.removeField("pubtokencrypt");

    dao.saveCollection(events);
  },
);
