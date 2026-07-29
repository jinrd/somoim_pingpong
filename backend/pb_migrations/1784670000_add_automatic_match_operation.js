/// <reference path="../pb_data/types.d.ts" />

migrate(
  (db) => {
    const dao = new Dao(db);

    const settingsCollection = dao.findCollectionByNameOrId(
      "event_game_settings",
    );

    const settingFields = settingsCollection.schema.asMap();

    if (!settingFields.individual_table_count) {
      settingsCollection.schema.addField(
        new SchemaField({
          id: "gamesettablecnt",
          name: "individual_table_count",
          type: "number",
          required: true,
          options: {
            min: 0,
            max: 30,
            noDecimal: true,
          },
        }),
      );
    }

    if (!settingFields.operation_status) {
      settingsCollection.schema.addField(
        new SchemaField({
          id: "gamesetopstate",
          name: "operation_status",
          type: "select",
          required: false,
          options: {
            maxSelect: 1,
            values: ["not_started", "in_progress", "completed"],
          },
        }),
      );
    }

    dao.saveCollection(settingsCollection);

    const individualMatchesCollection =
      dao.findCollectionByNameOrId("individual_matches");

    const matchFields = individualMatchesCollection.schema.asMap();

    if (!matchFields.table_number) {
      individualMatchesCollection.schema.addField(
        new SchemaField({
          id: "indmatchtable",
          name: "table_number",
          type: "number",
          required: false,
          options: {
            min: 0,
            max: 30,
            noDecimal: true,
          },
        }),
      );
    }

    dao.saveCollection(individualMatchesCollection);

    const settings = dao.findRecordsByFilter(
      "event_game_settings",
      "id != ''",
      "",
      500,
      0,
    );

    settings.forEach((setting) => {
      setting.set(
        "individual_table_count",
        setting.getString("competition_type") === "individual_singles" ? 4 : 0,
      );
      setting.set("operation_status", "not_started");

      dao.saveRecord(setting);
    });

    const individualMatches = dao.findRecordsByFilter(
      "individual_matches",
      "id != ''",
      "",
      500,
      0,
    );

    individualMatches.forEach((match) => {
      match.set("table_number", 0);
      dao.saveRecord(match);
    });
  },

  (db) => {
    const dao = new Dao(db);

    const individualMatchesCollection =
      dao.findCollectionByNameOrId("individual_matches");

    const matchFields = individualMatchesCollection.schema.asMap();

    if (matchFields.table_number) {
      individualMatchesCollection.schema.removeField("indmatchtable");
      dao.saveCollection(individualMatchesCollection);
    }

    const settingsCollection = dao.findCollectionByNameOrId(
      "event_game_settings",
    );

    const settingFields = settingsCollection.schema.asMap();

    if (settingFields.individual_table_count) {
      settingsCollection.schema.removeField("gamesettablecnt");
    }

    if (settingFields.operation_status) {
      settingsCollection.schema.removeField("gamesetopstate");
    }

    dao.saveCollection(settingsCollection);
  },
);
