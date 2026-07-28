/// <reference path="../pb_data/types.d.ts" />

const findHistoryByRequestId = function (dao, requestId) {
  try {
    return dao.findFirstRecordByFilter(
      "match_result_history",
      "request_id = {:requestId}",
      {
        requestId,
      },
    );
  } catch {
    return null;
  }
};

const createHistory = function (dao, input) {
  const collection = dao.findCollectionByNameOrId("match_result_history");
  const history = new Record(collection);

  history.set("event", input.eventId);
  history.set("target_type", input.targetType);

  history.set(
    "team_match",
    input.targetType === "team_match" ? input.targetId : "",
  );

  history.set(
    "match_game",
    input.targetType === "team_game" ? input.targetId : "",
  );

  history.set(
    "individual_match",
    input.targetType === "individual_match" ? input.targetId : "",
  );

  history.set("action", input.action);
  history.set("request_id", input.requestId);
  history.set("actor_type", input.actorType);

  history.set(
    "actor_participant",
    input.actorType === "participant" ? input.actorId : "",
  );

  history.set("actor_admin", input.actorType === "admin" ? input.actorId : "");

  history.set("actor_name", input.actorName);
  history.set("submitted_side", input.submittedSide || "");

  history.set(
    "before_data",
    input.beforeData ? JSON.stringify(input.beforeData) : "",
  );

  history.set(
    "after_data",
    input.afterData ? JSON.stringify(input.afterData) : "",
  );

  history.set("reason", input.reason || "");

  dao.saveRecord(history);

  return history;
};

module.exports = Object.freeze({
  findHistoryByRequestId,
  createHistory,
});
