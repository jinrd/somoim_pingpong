/// <reference path="../pb_data/types.d.ts" />

migrate(
  (db) => {
    const dao = new Dao(db);
    const eventsCollection = dao.findCollectionByNameOrId("events");
    const fields = eventsCollection.schema.asMap();

    /*
     * 기존 회차를 먼저 보정할 수 있도록 선택 필드로 추가한 뒤
     * 모든 레코드에 open을 저장하고 필수 필드로 변경합니다.
     */
    if (!fields.participation_status) {
      eventsCollection.schema.addField(
        new SchemaField({
          id: "eventregstatus",
          name: "participation_status",
          type: "select",
          required: false,
          options: {
            maxSelect: 1,
            values: ["open", "closed"],
          },
        }),
      );
    }

    if (!fields.participation_closed_at) {
      eventsCollection.schema.addField(
        new SchemaField({
          id: "eventregclosed",
          name: "participation_closed_at",
          type: "date",
          required: false,
          options: {
            min: "",
            max: "",
          },
        }),
      );
    }

    dao.saveCollection(eventsCollection);

    const existingEvents = dao.findRecordsByFilter(
      "events",
      "id != ''",
      "",
      500,
      0,
    );

    existingEvents.forEach((eventRecord) => {
      if (!eventRecord.getString("participation_status")) {
        let hasGameSetting = false;

        try {
          dao.findFirstRecordByFilter(
            "event_game_settings",
            "event = {:eventId}",
            { eventId: eventRecord.id },
          );
          hasGameSetting = true;
        } catch {
          // 아직 게임 설정이 없는 정상 회차
        }

        eventRecord.set(
          "participation_status",
          hasGameSetting ? "closed" : "open",
        );

        if (hasGameSetting) {
          eventRecord.set("participation_closed_at", new Date().toISOString());
        }

        dao.saveRecord(eventRecord);
      }
    });

    eventsCollection.schema.getFieldByName("participation_status").required =
      true;

    dao.saveCollection(eventsCollection);
  },

  (db) => {
    const dao = new Dao(db);
    const eventsCollection = dao.findCollectionByNameOrId("events");

    if (eventsCollection.schema.asMap().participation_closed_at) {
      eventsCollection.schema.removeField("eventregclosed");
    }

    if (eventsCollection.schema.asMap().participation_status) {
      eventsCollection.schema.removeField("eventregstatus");
    }

    dao.saveCollection(eventsCollection);
  },
);
