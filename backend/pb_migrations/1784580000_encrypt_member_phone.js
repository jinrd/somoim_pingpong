migrate(
  (db) => {
    const dao = new Dao(db);
    const members = dao.findCollectionByNameOrId("members");
    const secret = $os.getenv("PB_ENCRYPTION_KEY");

    if (!secret) {
      throw new Error("PB_ENCRYPTION_KEY is required.");
    }

    const encryptionKey = $security
      .sha256(`somoim:member-phone:encryption:${secret}`)
      .slice(0, 32);
    const hashKey = $security.sha256(
      `somoim:member-phone:lookup:${secret}`,
    );

    members.schema.addField(
      new SchemaField({
        id: "mbrphonehash",
        name: "phone_hash",
        type: "text",
        required: false,
        options: { min: null, max: 64, pattern: "" },
      }),
    );

    const phoneField = members.schema.getFieldByName("phone");
    phoneField.options = { min: null, max: 255, pattern: "" };

    members.indexes = [
      ...members.indexes,
      "CREATE INDEX `idx_members_identity` ON `members` (`name`, `phone_hash`)",
    ];

    dao.saveCollection(members);

    const records = dao.findRecordsByFilter(
      "members",
      "id != ''",
      "",
      10000,
      0,
    );

    records.forEach((record) => {
      const input = record.getString("phone").trim();

      if (!input) {
        record.set("phone", "");
        record.set("phone_hash", "");
        dao.saveRecord(record);
        return;
      }

      const digits = input.replace(/[^0-9]/g, "");

      if (digits.length !== 11 || digits.slice(0, 3) !== "010") {
        throw new Error(`Invalid member phone format: ${record.id}`);
      }

      const phone =
        digits.slice(0, 3) +
        "-" +
        digits.slice(3, 7) +
        "-" +
        digits.slice(7, 11);

      record.set("phone", $security.encrypt(phone, encryptionKey));
      record.set("phone_hash", $security.hs256(phone, hashKey));
      dao.saveRecord(record);
    });
  },
  (db) => {
    const dao = new Dao(db);
    const members = dao.findCollectionByNameOrId("members");
    const secret = $os.getenv("PB_ENCRYPTION_KEY");

    if (!secret) {
      throw new Error("PB_ENCRYPTION_KEY is required.");
    }

    const encryptionKey = $security
      .sha256(`somoim:member-phone:encryption:${secret}`)
      .slice(0, 32);
    const records = dao.findRecordsByFilter(
      "members",
      "id != ''",
      "",
      10000,
      0,
    );

    records.forEach((record) => {
      const encryptedPhone = record.getString("phone").trim();

      record.set(
        "phone",
        encryptedPhone
          ? String($security.decrypt(encryptedPhone, encryptionKey))
          : "",
      );
      dao.saveRecord(record);
    });

    members.indexes = members.indexes.filter(
      (index) => !index.includes("idx_members_identity"),
    );
    members.schema.removeField("mbrphonehash");

    const phoneField = members.schema.getFieldByName("phone");
    phoneField.options = {
      min: null,
      max: 13,
      pattern: "^010-[0-9]{4}-[0-9]{4}$",
    };

    dao.saveCollection(members);
  },
);
