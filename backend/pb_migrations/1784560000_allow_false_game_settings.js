/// <reference path="../pb_data/types.d.ts" />

migrate(
  (db) => {
    const dao = new Dao(db);

    const settingsCollection = dao.findCollectionByNameOrId(
      "event_game_settings",
    );

    settingsCollection.schema.getFieldByName("team_size").required = false;
    settingsCollection.schema.getFieldByName("auto_team_balance").required =
      false;
    settingsCollection.schema.getFieldByName(
      "individual_counts_for_ranking",
    ).required = false;

    dao.saveCollection(settingsCollection);

    const formatsCollection = dao.findCollectionByNameOrId(
      "event_match_formats",
    );

    formatsCollection.schema.getFieldByName("counts_for_ranking").required =
      false;

    dao.saveCollection(formatsCollection);
  },
  (db) => {
    const dao = new Dao(db);

    const settingsCollection = dao.findCollectionByNameOrId(
      "event_game_settings",
    );

    settingsCollection.schema.getFieldByName("team_size").required = true;
    settingsCollection.schema.getFieldByName("auto_team_balance").required =
      true;
    settingsCollection.schema.getFieldByName(
      "individual_counts_for_ranking",
    ).required = true;

    dao.saveCollection(settingsCollection);

    const formatsCollection = dao.findCollectionByNameOrId(
      "event_match_formats",
    );

    formatsCollection.schema.getFieldByName("counts_for_ranking").required =
      true;

    dao.saveCollection(formatsCollection);
  },
);
