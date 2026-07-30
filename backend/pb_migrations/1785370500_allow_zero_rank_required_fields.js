/// <reference path="../pb_data/types.d.ts" />
migrate(
  (db) => {
    const dao = new Dao(db);
    const fields = [
      ["members", "rank"],
      ["rank_settings", "min_rank"],
      ["rank_settings", "default_member_rank"],
      ["rank_settings", "default_guest_rank"],
      ["event_participants", "rank_snapshot"],
      ["team_members", "rank_snapshot"],
      ["ranking_adjustment_candidates", "current_rank"],
      ["ranking_adjustment_candidates", "proposed_rank"],
      ["member_rank_history", "previous_rank"],
      ["member_rank_history", "new_rank"],
    ];

    fields.forEach(([collectionName, fieldName]) => {
      const collection = dao.findCollectionByNameOrId(collectionName);
      const field = collection.schema.getFieldByName(fieldName);

      field.required = false;
      dao.saveCollection(collection);
    });
  },
  (db) => {
    const dao = new Dao(db);
    const fields = [
      ["members", "rank"],
      ["rank_settings", "min_rank"],
      ["rank_settings", "default_member_rank"],
      ["rank_settings", "default_guest_rank"],
      ["event_participants", "rank_snapshot"],
      ["team_members", "rank_snapshot"],
      ["ranking_adjustment_candidates", "current_rank"],
      ["ranking_adjustment_candidates", "proposed_rank"],
      ["member_rank_history", "previous_rank"],
      ["member_rank_history", "new_rank"],
    ];

    fields.forEach(([collectionName, fieldName]) => {
      const collection = dao.findCollectionByNameOrId(collectionName);
      const field = collection.schema.getFieldByName(fieldName);

      field.required = true;
      dao.saveCollection(collection);
    });
  },
);
