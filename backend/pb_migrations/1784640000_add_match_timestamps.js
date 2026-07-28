/// <reference path="../pb_data/types.d.ts" />

migrate(
  (db) => {
    const dao = new Dao(db);

    const collectionNames = ["team_matches", "individual_matches"];

    collectionNames.forEach((collectionName) => {
      const collection = dao.findCollectionByNameOrId(collectionName);
      const fields = collection.schema.asMap();

      if (!fields.started_at) {
        collection.schema.addField(
          new SchemaField({
            id:
              collectionName === "team_matches"
                ? "teammatchstart"
                : "indmatchstart",
            name: "started_at",
            type: "date",
            required: false,
            options: {
              min: "",
              max: "",
            },
          }),
        );
      }

      if (!fields.completed_at) {
        collection.schema.addField(
          new SchemaField({
            id:
              collectionName === "team_matches"
                ? "teammatchdone"
                : "indmatchdone",
            name: "completed_at",
            type: "date",
            required: false,
            options: {
              min: "",
              max: "",
            },
          }),
        );
      }

      dao.saveCollection(collection);
    });
  },

  (db) => {
    const dao = new Dao(db);

    const collectionNames = ["team_matches", "individual_matches"];

    collectionNames.forEach((collectionName) => {
      const collection = dao.findCollectionByNameOrId(collectionName);
      const fields = collection.schema.asMap();

      if (fields.started_at) {
        collection.schema.removeField(
          collectionName === "team_matches"
            ? "teammatchstart"
            : "indmatchstart",
        );
      }

      if (fields.completed_at) {
        collection.schema.removeField(
          collectionName === "team_matches" ? "teammatchdone" : "indmatchdone",
        );
      }

      dao.saveCollection(collection);
    });
  },
);
