migrate((db) => {
  const dao = new Dao(db);
  const members = dao.findCollectionByNameOrId("members");
  const phoneField = members.schema.getFieldByName("phone");

  phoneField.options = {
    min: null,
    max: 13,
    pattern: "^010-[0-9]{4}-[0-9]{4}$",
  };

  dao.saveCollection(members);
}, (db) => {
  const dao = new Dao(db);
  const members = dao.findCollectionByNameOrId("members");
  const phoneField = members.schema.getFieldByName("phone");

  phoneField.options = {
    min: null,
    max: 30,
    pattern: "",
  };

  dao.saveCollection(members);
});
