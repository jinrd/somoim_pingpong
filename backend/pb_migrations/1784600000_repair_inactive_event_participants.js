/// <reference path="../pb_data/types.d.ts" />

/*
 * 무결성 훅을 추가하기 전에 이미 회차에 등록돼 있던 비활동 회원을 정리합니다.
 * 완료/보관 회차의 snapshot과 결과 기록은 변경하지 않습니다.
 */
migrate(
  (db) => {
    const dao = new Dao(db);

    const inactiveMembers = dao.findRecordsByFilter(
      "members",
      "status = {:status}",
      "",
      1000,
      0,
      {
        status: "inactive",
      },
    );

    const invalidatedFormationIds = new Set();

    inactiveMembers.forEach((memberRecord) => {
      const participantRecords = dao.findRecordsByFilter(
        "event_participants",
        "member = {:memberId}",
        "",
        1000,
        0,
        {
          memberId: memberRecord.id,
        },
      );

      participantRecords.forEach((participantRecord) => {
        let eventRecord;

        try {
          eventRecord = dao.findRecordById(
            "events",
            participantRecord.getString("event"),
          );
        } catch {
          return;
        }

        if (!["draft", "active"].includes(eventRecord.getString("status"))) {
          return;
        }

        participantRecord.set("game_participation_status", "not_playing");
        participantRecord.set("participation_token_hash", "");
        participantRecord.set(
          "version",
          participantRecord.getInt("version") + 1,
        );

        dao.saveRecord(participantRecord);

        const teamMemberRecords = dao.findRecordsByFilter(
          "team_members",
          "participant = {:participantId}",
          "",
          100,
          0,
          {
            participantId: participantRecord.id,
          },
        );

        teamMemberRecords.forEach((teamMemberRecord) => {
          const formationId = teamMemberRecord.getString("formation");

          if (!formationId || invalidatedFormationIds.has(formationId)) {
            return;
          }

          let formationRecord;

          try {
            formationRecord = dao.findRecordById(
              "team_formations",
              formationId,
            );
          } catch {
            return;
          }

          formationRecord.set("status", "draft");
          formationRecord.set(
            "version",
            formationRecord.getInt("version") + 1,
          );

          dao.saveRecord(formationRecord);
          invalidatedFormationIds.add(formationId);
        });
      });
    });
  },

  /*
   * 제거한 개인 응답 토큰은 복원할 수 없고, 비활동 회원을 다시 참가 상태로
   * 되돌리는 것도 안전하지 않으므로 rollback에서는 데이터를 변경하지 않습니다.
   */
  () => {},
);
