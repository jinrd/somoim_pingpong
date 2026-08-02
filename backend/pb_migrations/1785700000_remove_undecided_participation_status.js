/// <reference path="../pb_data/types.d.ts" />

migrate(
  (db) => {
    const dao = new Dao(db);

    db.newQuery(
      "UPDATE event_participants SET game_participation_status = 'playing' WHERE game_participation_status = 'undecided'",
    ).execute();

    const collection = dao.findCollectionByNameOrId("event_participants");
    const field = collection.schema.getFieldByName(
      "game_participation_status",
    );

    field.options.values = ["playing", "not_playing"];
    dao.saveCollection(collection);
  },
  (db) => {
    const dao = new Dao(db);
    const collection = dao.findCollectionByNameOrId("event_participants");
    const field = collection.schema.getFieldByName(
      "game_participation_status",
    );

    field.options.values = ["undecided", "playing", "not_playing"];
    dao.saveCollection(collection);
  },
);
