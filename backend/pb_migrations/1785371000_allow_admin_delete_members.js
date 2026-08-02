/// <reference path="../pb_data/types.d.ts" />

migrate(
  (db) => {
    const dao = new Dao(db);
    const collection = dao.findCollectionByNameOrId("members");

    collection.deleteRule =
      "@request.auth.id != '' && @request.auth.role = 'admin' && @request.auth.active = true";

    dao.saveCollection(collection);
  },
  (db) => {
    const dao = new Dao(db);
    const collection = dao.findCollectionByNameOrId("members");

    collection.deleteRule = null;

    dao.saveCollection(collection);
  },
);
