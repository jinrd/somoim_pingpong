/// <reference path="../pb_data/types.d.ts" />

/**
 * 관리자 전용: 회차 공용 링크 발급 또는 재발급
 *
 * POST /api/somoim/admin/events/:eventId/public-link
 *
 * body:
 * {
 *   "expiresAt": "2026-07-25 23:59:59.000Z"
 * }
 */
routerAdd(
  "POST",
  "/api/somoim/admin/events/:eventId/public-link",
  (context) => {
    const config = require(`${__hooks}/config.js`);

    const encryptionSecret = $os.getenv("PB_ENCRYPTION_KEY");

    if (!encryptionSecret) {
      throw new BadRequestError("서버 암호화 키 설정을 확인해 주세요.");
    }

    const encryptionKey =
      config.createPublicTokenEncryptionKey(encryptionSecret);

    const eventId = context.pathParam("eventId");
    /** @type {any} */
    const requestData = new DynamicModel({
      expiresAt: "",
    });

    context.bind(requestData);

    const eventRecord = $app.dao().findRecordById("events", eventId);

    if (!eventRecord) {
      throw new NotFoundError("해당 회차를 찾을 수 없습니다.");
    }

    if (eventRecord.getString("status") === "archived") {
      throw new BadRequestError(
        "보관된 회차에는 공개 링크를 발급할 수 없습니다.",
      );
    }

    const expiresAt = String(requestData.expiresAt || "").trim();

    if (!expiresAt) {
      throw new BadRequestError("공개 링크 만료 시간을 입력해 주세요.");
    }

    const parsedExpiresAt = new Date(expiresAt);

    if (
      Number.isNaN(parsedExpiresAt.getTime()) ||
      parsedExpiresAt.getTime() <= Date.now()
    ) {
      throw new BadRequestError("공개 링크 만료 시간은 현재 이후여야 합니다.");
    }

    const publicToken = $security.randomString(config.PUBLIC_LINK_TOKEN_LENGTH);

    const publicTokenHash = $security.sha256(publicToken);

    const encryptedPublicToken = $security.encrypt(publicToken, encryptionKey);

    eventRecord.set("public_token_hash", publicTokenHash);

    eventRecord.set("public_token_encrypted", encryptedPublicToken);

    eventRecord.set("public_access_enabled", true);

    eventRecord.set("public_expires_at", parsedExpiresAt.toISOString());

    eventRecord.set("version", eventRecord.getInt("version") + 1);

    $app.dao().saveRecord(eventRecord);

    return context.json(200, {
      token: publicToken,
      expiresAt: parsedExpiresAt.toISOString(),
    });
  },
  require(`${__hooks}/admin_auth.js`).requireActiveAdmin,
);

/**
 * 관리자 전용: 현재 회차의 공개 링크 조회
 *
 * GET /api/somoim/admin/events/:eventId/public-link
 */
routerAdd(
  "GET",
  "/api/somoim/admin/events/:eventId/public-link",
  (context) => {
    const config = require(`${__hooks}/config.js`);

    const eventId = context.pathParam("eventId");

    const encryptionSecret = $os.getenv("PB_ENCRYPTION_KEY");

    if (!encryptionSecret) {
      throw new BadRequestError("서버 암호화 키 설정을 확인해 주세요.");
    }

    const encryptionKey =
      config.createPublicTokenEncryptionKey(encryptionSecret);

    const eventRecord = $app.dao().findRecordById("events", eventId);

    if (!eventRecord) {
      throw new NotFoundError("해당 회차를 찾을 수 없습니다.");
    }

    const enabled = eventRecord.getBool("public_access_enabled");

    const expiresAt = eventRecord.getString("public_expires_at");

    const encryptedToken = eventRecord.getString("public_token_encrypted");

    if (!enabled) {
      return context.json(200, {
        enabled: false,
        recoverable: false,
        token: "",
        expiresAt: "",
      });
    }

    // migration 이전에 만들어진 링크는
    // 암호화된 원본 토큰이 없으므로 복원할 수 없습니다.
    if (!encryptedToken) {
      return context.json(200, {
        enabled: true,
        recoverable: false,
        token: "",
        expiresAt,
      });
    }

    let publicToken;

    try {
      publicToken = $security.decrypt(encryptedToken, encryptionKey);
    } catch {
      throw new BadRequestError(
        "기존 링크를 복호화하지 못했습니다. 링크를 재발급해 주세요.",
      );
    }

    return context.json(200, {
      enabled: true,
      recoverable: true,
      token: String(publicToken),
      expiresAt,
    });
  },
  require(`${__hooks}/admin_auth.js`).requireActiveAdmin,
);

/**
 * 관리자 전용: 회차 공용 링크 비활성화
 *
 * DELETE /api/somoim/admin/events/:eventId/public-link
 */
routerAdd(
  "DELETE",
  "/api/somoim/admin/events/:eventId/public-link",
  (context) => {
    const eventId = context.pathParam("eventId");

    const eventRecord = $app.dao().findRecordById("events", eventId);

    if (!eventRecord) {
      throw new NotFoundError("해당 회차를 찾을 수 없습니다.");
    }

    eventRecord.set("public_token_hash", "");

    eventRecord.set("public_token_encrypted", "");

    eventRecord.set("public_access_enabled", false);

    eventRecord.set("public_expires_at", "");

    eventRecord.set("version", eventRecord.getInt("version") + 1);

    $app.dao().saveRecord(eventRecord);

    return context.noContent(204);
  },
  require(`${__hooks}/admin_auth.js`).requireActiveAdmin,
);

/**
 * 공개 사용자용: 토큰으로 공개 가능한 회차 정보 조회
 *
 * GET /api/somoim/public/events/:token
 *
 * members나 event_participants 컬렉션을 직접 공개하지 않고,
 * 공개해도 되는 회차 정보만 DTO 형태로 반환합니다.
 */
routerAdd("GET", "/api/somoim/public/events/:token", (context) => {
  const publicAccess = require(`${__hooks}/public_event_access.js`);

  const eventRecord = publicAccess.findEventByPublicToken(
    context.pathParam("token"),
  );

  const expiresAt = eventRecord.getString("public_expires_at");

  return context.json(200, {
    event: {
      id: eventRecord.id,
      title: eventRecord.getString("title"),
      eventDate: eventRecord.getString("event_date"),
      notice: eventRecord.getString("notice"),
      status: eventRecord.getString("status"),
      participationStatus: eventRecord.getString("participation_status"),
      participationClosedAt: eventRecord.getString(
        "participation_closed_at",
      ),
    },
    expiresAt,
  });
});

/**
 * 공개 사용자: 이름과 연락처로 회원 본인 확인
 *
 * POST /api/somoim/public/events/:token/identify
 *
 * body:
 * {
 *   "name": "홍길동",
 *   "phone": "010-1234-5678"
 * }
 */
routerAdd("POST", "/api/somoim/public/events/:token/identify", (context) => {
  const config = require(`${__hooks}/config.js`);

  /*
   * 1. 공용 회차 토큰 검증
   */
  const publicAccess = require(`${__hooks}/public_event_access.js`);

  const eventRecord = publicAccess.findEventByPublicToken(
    context.pathParam("token"),
  );

  /*
   * 2. 요청 body 확인
   */
  /** @type {any} */
  const requestData = new DynamicModel({
    name: "",
    phone: "",
  });

  context.bind(requestData);

  const name = String(requestData.name || "").trim();

  const phoneDigits = String(requestData.phone || "").replace(/[^0-9]/g, "");

  // 사용자 존재 여부 추측을 막기 위해
  // 형식 오류와 회원 불일치에 같은 메시지를 사용합니다.
  const identityErrorMessage =
    "입력한 정보와 일치하는 회원을 찾을 수 없습니다.";

  if (!name || phoneDigits.length !== 11 || phoneDigits.slice(0, 3) !== "010") {
    throw new BadRequestError(identityErrorMessage);
  }

  const formattedPhone =
    phoneDigits.slice(0, 3) +
    "-" +
    phoneDigits.slice(3, 7) +
    "-" +
    phoneDigits.slice(7, 11);

  const privacy = require(`${__hooks}/member_privacy.js`);

  const phoneHash = privacy.hashPhone(formattedPhone);

  /*
   * 3. 이름과 연락처가 모두 일치하는 활성 회원 조회
   */
  const matchingMembers = $app
    .dao()
    .findRecordsByFilter(
      "members",
      [
        "name = {:name}",
        "phone_hash = {:phoneHash}",
        "status = {:status}",
      ].join(" && "),
      "",
      2,
      0,
      {
        name,
        phoneHash,
        status: "active",
      },
    );

  // 0명뿐 아니라 중복 회원이 있어도 본인 확인 실패
  if (matchingMembers.length !== 1) {
    throw new BadRequestError(identityErrorMessage);
  }

  const memberRecord = matchingMembers[0];

  /*
   * 4. 기존 참석자 조회
   */
  let participantRecord = null;

  try {
    participantRecord = $app
      .dao()
      .findFirstRecordByFilter(
        "event_participants",
        ["event = {:eventId}", "member = {:memberId}"].join(" && "),
        {
          eventId: eventRecord.id,
          memberId: memberRecord.id,
        },
      );
  } catch {
    // 아직 참석자로 등록되지 않은 정상 상황
  }

  /*
   * 5. 참석자가 없다면 새로 생성
   */
  if (!participantRecord) {
    const workflow = require(`${__hooks}/event_workflow_service.js`);

    workflow.assertRegistrationOpen(eventRecord);
    workflow.assertSetupEditable($app.dao(), eventRecord.id);

    const participantsCollection = $app
      .dao()
      .findCollectionByNameOrId("event_participants");

    participantRecord = new Record(participantsCollection);

    const nickname = memberRecord.getString("nickname").trim();

    const memberName = memberRecord.getString("name").trim();

    participantRecord.set("event", eventRecord.id);

    participantRecord.set("participant_type", "member");

    participantRecord.set("member", memberRecord.id);

    participantRecord.set("guest_name", "");

    participantRecord.set("display_name", nickname || memberName);

    participantRecord.set("rank_snapshot", memberRecord.getInt("rank"));

    participantRecord.set("game_participation_status", "playing");

    participantRecord.set("participation_responded_at", "");

    participantRecord.set("version", 1);
  } else {
    participantRecord.set("version", participantRecord.getInt("version") + 1);
  }

  /*
   * 6. 참가자 본인 응답용 개인 토큰 발급
   *
   * 본인 확인을 다시 하면 이전 개인 토큰은
   * 즉시 무효화됩니다.
   */
  const responseToken = $security.randomString(
    config.PARTICIPATION_TOKEN_LENGTH,
  );

  participantRecord.set(
    "participation_token_hash",
    $security.sha256(responseToken),
  );

  $app.dao().saveRecord(participantRecord);

  let competitionType = "unknown";
  try {
    const gameSettingRecord = $app
      .dao()
      .findFirstRecordByFilter(
        "event_game_settings",
        "event = {:eventId} && status = 'confirmed'",
        { eventId: eventRecord.id },
      );
    competitionType = gameSettingRecord.getString("competition_type");
  } catch {
    // 확정된 게임 설정이 없으면 unknown 유지
  }

  let participantTeam = null;

  if (competitionType === "team_league") {
    try {
      const teamMatchesService = require(
        `${__hooks}/team_lineups_service.js`,
      );
      const teamContext = teamMatchesService.listParticipantMatches(
        responseToken,
      );

      if (teamContext.team) {
        participantTeam = {
          id: teamContext.team.id,
          name: teamContext.team.name,
          sortOrder: teamContext.team.sortOrder,
          members: teamContext.members,
        };
      }
    } catch {
      participantTeam = null;
    }
  }

  return context.json(200, {
    responseToken,
    competitionType,
    participant: {
      displayName: participantRecord.getString("display_name"),
      rank: participantRecord.getInt("rank_snapshot"),
      gameParticipationStatus: participantRecord.getString(
        "game_participation_status",
      ),
      hasResponded: Boolean(
        participantRecord.getString("participation_responded_at"),
      ),
      team: participantTeam,
    },
  });
});

/**
 * 공개 참가자: 저장된 본인 확인 토큰으로 최신 참가 정보 조회
 */
routerAdd("POST", "/api/somoim/public/participants/identity", (context) => {
  const config = require(`${__hooks}/config.js`);
  const requestData = new DynamicModel({ responseToken: "" });

  context.bind(requestData);

  const responseToken = String(requestData.responseToken || "").trim();

  if (
    !responseToken ||
    responseToken.length !== config.PARTICIPATION_TOKEN_LENGTH
  ) {
    throw new NotFoundError("유효하지 않은 본인 확인 정보입니다.");
  }

  let participantRecord;

  try {
    participantRecord = $app
      .dao()
      .findFirstRecordByFilter(
        "event_participants",
        "participation_token_hash = {:tokenHash}",
        { tokenHash: $security.sha256(responseToken) },
      );
  } catch {
    throw new NotFoundError("유효하지 않은 본인 확인 정보입니다.");
  }

  let eventRecord;

  try {
    eventRecord = $app
      .dao()
      .findRecordById("events", participantRecord.getString("event"));
  } catch {
    throw new NotFoundError("회차 정보를 찾을 수 없습니다.");
  }

  const publicAccess = require(`${__hooks}/public_event_access.js`);

  publicAccess.assertEventPublicAccess(eventRecord);

  let competitionType = "unknown";

  try {
    const gameSettingRecord = $app
      .dao()
      .findFirstRecordByFilter(
        "event_game_settings",
        "event = {:eventId} && status = 'confirmed'",
        { eventId: eventRecord.id },
      );

    competitionType = gameSettingRecord.getString("competition_type");
  } catch {
    // 확정된 게임 설정이 없으면 unknown을 유지합니다.
  }

  let participantTeam = null;

  if (competitionType === "team_league") {
    try {
      const teamMatchesService = require(
        `${__hooks}/team_lineups_service.js`,
      );
      const teamContext = teamMatchesService.listParticipantMatches(
        responseToken,
      );

      if (teamContext.team) {
        participantTeam = {
          id: teamContext.team.id,
          name: teamContext.team.name,
          sortOrder: teamContext.team.sortOrder,
          members: teamContext.members,
        };
      }
    } catch {
      participantTeam = null;
    }
  }

  return context.json(200, {
    responseToken,
    competitionType,
    participant: {
      displayName: participantRecord.getString("display_name"),
      rank: participantRecord.getInt("rank_snapshot"),
      gameParticipationStatus: participantRecord.getString(
        "game_participation_status",
      ),
      hasResponded: Boolean(
        participantRecord.getString("participation_responded_at"),
      ),
      team: participantTeam,
    },
  });
});

/**
 * 공개 참가자: 본인의 게임 참가 여부 변경
 *
 * PATCH /api/somoim/public/participants/game-status
 *
 * body:
 * {
 *   "responseToken": "개인 응답 토큰",
 *   "gameParticipationStatus": "playing"
 * }
 */
routerAdd("PATCH", "/api/somoim/public/participants/game-status", (context) => {
  const config = require(`${__hooks}/config.js`);

  /** @type {any} */
  const requestData = new DynamicModel({
    responseToken: "",
    gameParticipationStatus: "",
  });

  context.bind(requestData);

  const responseToken = String(requestData.responseToken || "").trim();

  const gameParticipationStatus = String(
    requestData.gameParticipationStatus || "",
  ).trim();

  /* 참가자는 게임 참가 또는 미참가만 선택합니다. */
  if (
    gameParticipationStatus !== "playing" &&
    gameParticipationStatus !== "not_playing"
  ) {
    throw new BadRequestError("게임 참가 여부를 선택해 주세요.");
  }

  if (
    !responseToken ||
    responseToken.length !== config.PARTICIPATION_TOKEN_LENGTH
  ) {
    throw new NotFoundError("유효하지 않은 본인 확인 정보입니다.");
  }

  const responseTokenHash = $security.sha256(responseToken);

  /*
   * 개인 토큰으로 참가자 한 명만 조회합니다.
   */
  let participantRecord;

  try {
    participantRecord = $app
      .dao()
      .findFirstRecordByFilter(
        "event_participants",
        "participation_token_hash = {:tokenHash}",
        {
          tokenHash: responseTokenHash,
        },
      );
  } catch {
    throw new NotFoundError("유효하지 않은 본인 확인 정보입니다.");
  }

  /*
   * 토큰을 발급받은 뒤 회원이 비활동으로 변경될 수도 있으므로
   * 실제 참가 상태 저장 직전에 회원 상태를 다시 확인합니다.
   */
  if (participantRecord.getString("participant_type") === "member") {
    let memberRecord;

    try {
      memberRecord = $app
        .dao()
        .findRecordById("members", participantRecord.getString("member"));
    } catch {
      throw new NotFoundError("회원 정보를 찾을 수 없습니다.");
    }

    if (memberRecord.getString("status") !== "active") {
      throw new BadRequestError(
        "비활동 회원은 게임 참가 여부를 변경할 수 없습니다.",
      );
    }
  }

  /*
   * 참가자가 속한 회차를 확인합니다.
   */
  const eventId = participantRecord.getString("event");

  let eventRecord;

  try {
    eventRecord = $app.dao().findRecordById("events", eventId);
  } catch {
    throw new NotFoundError("회차 정보를 찾을 수 없습니다.");
  }

  const publicAccess = require(`${__hooks}/public_event_access.js`);

  publicAccess.assertEventPublicAccess(eventRecord);

  const workflow = require(`${__hooks}/event_workflow_service.js`);

  workflow.assertRegistrationOpen(eventRecord);
  workflow.assertSetupEditable($app.dao(), eventId);

  /*
   * 한 번만 응답할 수 있도록 조회와 저장을 같은 트랜잭션에서 처리합니다.
   */
  let respondedAt = "";
  let savedParticipant = null;

  $app.dao().runInTransaction((transactionDao) => {
    const currentParticipant = transactionDao.findRecordById(
      "event_participants",
      participantRecord.id,
    );
    const currentEvent = transactionDao.findRecordById("events", eventId);

    workflow.assertRegistrationOpen(currentEvent);
    workflow.assertSetupEditable(transactionDao, eventId);

    if (currentParticipant.getString("participation_responded_at")) {
      throw new BadRequestError(
        "이미 참가 여부를 제출했습니다. 변경이 필요하면 운영진에게 문의해 주세요.",
      );
    }

    respondedAt = new Date().toISOString();

    currentParticipant.set(
      "game_participation_status",
      gameParticipationStatus,
    );
    currentParticipant.set("participation_responded_at", respondedAt);
    currentParticipant.set(
      "version",
      currentParticipant.getInt("version") + 1,
    );

    transactionDao.saveRecord(currentParticipant);
    savedParticipant = currentParticipant;
  });

  return context.json(200, {
    participant: {
      displayName: savedParticipant.getString("display_name"),
      rank: savedParticipant.getInt("rank_snapshot"),
      gameParticipationStatus: savedParticipant.getString(
        "game_participation_status",
      ),
      hasResponded: true,
      team: null,
    },
    respondedAt,
  });
});

/**
 * 공개 사용자: 게스트 이름으로 본인 확인 및 개인 토큰 발급
 * POST /api/somoim/public/events/:token/identify-guest
 *
 * body: { "guestName": "김게스트" }
 */
routerAdd(
  "POST",
  "/api/somoim/public/events/:token/identify-guest",
  (context) => {
    const config = require(`${__hooks}/config.js`);
    /*
     * 1. 공용 회차 토큰 검증
     */
    const publicAccess = require(`${__hooks}/public_event_access.js`);

    const eventRecord = publicAccess.findEventByPublicToken(
      context.pathParam("token"),
    );

    /** @type {any} */
    const requestData = new DynamicModel({ guestName: "" });
    context.bind(requestData);
    const guestName = String(requestData.guestName || "").trim();

    if (!guestName) {
      throw new BadRequestError("게스트 이름을 입력하거나 선택해 주세요.");
    }

    // 2. 해당 회차에 등록된 게스트 참가자 조회
    const matchingGuests = $app
      .dao()
      .findRecordsByFilter(
        "event_participants",
        "event = {:eventId} && participant_type = 'guest' && display_name = {:guestName}",
        "",
        2,
        0,
        { eventId: eventRecord.id, guestName },
      );

    if (matchingGuests.length === 0) {
      throw new BadRequestError(
        "입력한 이름의 게스트 참가자를 찾을 수 없습니다.",
      );
    }

    const participantRecord = matchingGuests[0];

    // 3. 본인 응답용 개인 토큰 발급
    const responseToken = $security.randomString(
      config.PARTICIPATION_TOKEN_LENGTH,
    );
    participantRecord.set(
      "participation_token_hash",
      $security.sha256(responseToken),
    );
    $app.dao().saveRecord(participantRecord);

    let competitionType = "unknown";
    try {
      const gameSettingRecord = $app
        .dao()
        .findFirstRecordByFilter(
          "event_game_settings",
          "event = {:eventId} && status = 'confirmed'",
          { eventId: eventRecord.id },
        );
      competitionType = gameSettingRecord.getString("competition_type");
    } catch {
      // 확정된 게임 설정이 없으면 unknown 유지
    }

    return context.json(200, {
      responseToken,
      competitionType,
      participant: {
        displayName: participantRecord.getString("display_name"),
        rank: participantRecord.getInt("rank_snapshot"),
        gameParticipationStatus: participantRecord.getString(
          "game_participation_status",
        ),
        hasResponded: Boolean(
          participantRecord.getString("participation_responded_at"),
        ),
      },
    });
  },
);
