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
  'POST',
  '/api/somoim/admin/events/:eventId/public-link',
  (context) => {

    const config = require(
      `${__hooks}/config.js`,
    );

    const encryptionSecret = $os.getenv(
      'PB_ENCRYPTION_KEY',
    );

    if (!encryptionSecret) {
      throw new BadRequestError(
        '서버 암호화 키 설정을 확인해 주세요.',
      );
    }

    const encryptionKey =
      config.createPublicTokenEncryptionKey(
        encryptionSecret,
      );

    const eventId = context.pathParam('eventId');

    const requestData = new DynamicModel({
      expiresAt: '',
    });

    context.bind(requestData);

    const eventRecord = $app
      .dao()
      .findRecordById('events', eventId);

    if (!eventRecord) {
      throw new NotFoundError(
        '해당 회차를 찾을 수 없습니다.',
      );
    }

    if (eventRecord.getString('status') === 'archived') {
      throw new BadRequestError(
        '보관된 회차에는 공개 링크를 발급할 수 없습니다.',
      );
    }

    const expiresAt = String(
      requestData.expiresAt || '',
    ).trim();

    if (!expiresAt) {
      throw new BadRequestError(
        '공개 링크 만료 시간을 입력해 주세요.',
      );
    }

    const parsedExpiresAt = new Date(expiresAt);

    if (
      Number.isNaN(parsedExpiresAt.getTime()) ||
      parsedExpiresAt.getTime() <= Date.now()
    ) {
      throw new BadRequestError(
        '공개 링크 만료 시간은 현재 이후여야 합니다.',
      );
    }

    const publicToken = $security.randomString(
      config.PUBLIC_LINK_TOKEN_LENGTH,
    );

    const publicTokenHash =
      $security.sha256(publicToken);

    const encryptedPublicToken =
      $security.encrypt(
        publicToken,
        encryptionKey,
      );

    eventRecord.set(
      'public_token_hash',
      publicTokenHash,
    );

    eventRecord.set(
      'public_token_encrypted',
      encryptedPublicToken,
    );

    eventRecord.set(
      'public_access_enabled',
      true,
    );

    eventRecord.set(
      'public_expires_at',
      parsedExpiresAt.toISOString(),
    );

    eventRecord.set(
      'version',
      eventRecord.getInt('version') + 1,
    );

    $app.dao().saveRecord(eventRecord);

    return context.json(200, {
      token: publicToken,
      expiresAt: parsedExpiresAt.toISOString(),
    });
  },
  $apis.requireRecordAuth('users'),
);

/**
 * 관리자 전용: 현재 회차의 공개 링크 조회
 *
 * GET /api/somoim/admin/events/:eventId/public-link
 */
routerAdd(
  'GET',
  '/api/somoim/admin/events/:eventId/public-link',
  (context) => {
    const config = require(
      `${__hooks}/config.js`,
    );

    const eventId =
      context.pathParam('eventId');

    const encryptionSecret = $os.getenv(
      'PB_ENCRYPTION_KEY',
    );

    if (!encryptionSecret) {
      throw new BadRequestError(
        '서버 암호화 키 설정을 확인해 주세요.',
      );
    }

    const encryptionKey =
      config.createPublicTokenEncryptionKey(
        encryptionSecret,
      );

    const eventRecord = $app
      .dao()
      .findRecordById(
        'events',
        eventId,
      );

    if (!eventRecord) {
      throw new NotFoundError(
        '해당 회차를 찾을 수 없습니다.',
      );
    }

    const enabled = eventRecord.getBool(
      'public_access_enabled',
    );

    const expiresAt =
      eventRecord.getString(
        'public_expires_at',
      );

    const encryptedToken =
      eventRecord.getString(
        'public_token_encrypted',
      );

    if (!enabled) {
      return context.json(200, {
        enabled: false,
        recoverable: false,
        token: '',
        expiresAt: '',
      });
    }

    // migration 이전에 만들어진 링크는
    // 암호화된 원본 토큰이 없으므로 복원할 수 없습니다.
    if (!encryptedToken) {
      return context.json(200, {
        enabled: true,
        recoverable: false,
        token: '',
        expiresAt,
      });
    }

    let publicToken;

    try {
      publicToken = $security.decrypt(
        encryptedToken,
        encryptionKey,
      );
    } catch {
      throw new BadRequestError(
        '기존 링크를 복호화하지 못했습니다. 링크를 재발급해 주세요.',
      );
    }

    return context.json(200, {
      enabled: true,
      recoverable: true,
      token: String(publicToken),
      expiresAt,
    });
  },
  $apis.requireRecordAuth('users'),
);


/**
 * 관리자 전용: 회차 공용 링크 비활성화
 *
 * DELETE /api/somoim/admin/events/:eventId/public-link
 */
routerAdd(
  'DELETE',
  '/api/somoim/admin/events/:eventId/public-link',
  (context) => {
    const eventId = context.pathParam('eventId');

    const eventRecord = $app
      .dao()
      .findRecordById('events', eventId);

    if (!eventRecord) {
      throw new NotFoundError(
        '해당 회차를 찾을 수 없습니다.',
      );
    }

    eventRecord.set('public_token_hash', '');
    
    eventRecord.set(
      'public_token_encrypted',
      '',
    );
    
    eventRecord.set(
      'public_access_enabled',
      false,
    );

    eventRecord.set('public_expires_at', '');

    eventRecord.set(
      'version',
      eventRecord.getInt('version') + 1,
    );

    $app.dao().saveRecord(eventRecord);

    return context.noContent(204);
  },
  $apis.requireRecordAuth('users'),
);

/**
 * 공개 사용자용: 토큰으로 공개 가능한 회차 정보 조회
 *
 * GET /api/somoim/public/events/:token
 *
 * members나 event_participants 컬렉션을 직접 공개하지 않고,
 * 공개해도 되는 회차 정보만 DTO 형태로 반환합니다.
 */
routerAdd(
  'GET',
  '/api/somoim/public/events/:token',
  (context) => {
    const config = require(
      `${__hooks}/config.js`,
    );

    const publicToken = context.pathParam('token');

    if (
      !publicToken ||
      publicToken.length !== config.PUBLIC_LINK_TOKEN_LENGTH
    ) {
      throw new NotFoundError(
        '유효하지 않은 참석 링크입니다.',
      );
    }

    const tokenHash = $security.sha256(publicToken);

    let eventRecord;

    try {
      eventRecord = $app
        .dao()
        .findFirstRecordByFilter(
          'events',
          'public_token_hash = {:tokenHash}',
          {
            tokenHash,
          },
        );
    } catch {
      throw new NotFoundError(
        '유효하지 않은 참석 링크입니다.',
      );
    }

    if (!eventRecord.getBool('public_access_enabled')) {
      throw new NotFoundError(
        '비활성화된 참석 링크입니다.',
      );
    }

    const expiresAt = eventRecord.getString(
      'public_expires_at',
    );

    if (
      !expiresAt ||
      new Date(expiresAt).getTime() <= Date.now()
    ) {
      throw new NotFoundError(
        '만료된 참석 링크입니다.',
      );
    }

    if (eventRecord.getString('status') === 'archived') {
      throw new NotFoundError(
        '종료된 참석 링크입니다.',
      );
    }

    return context.json(200, {
      event: {
        id: eventRecord.id,
        title: eventRecord.getString('title'),
        eventDate:
          eventRecord.getString('event_date'),
        notice: eventRecord.getString('notice'),
        status: eventRecord.getString('status'),
      },
      expiresAt,
    });
  },
);

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
routerAdd(
  'POST',
  '/api/somoim/public/events/:token/identify',
  (context) => {
    const config = require(
      `${__hooks}/config.js`,
    );

    const publicToken =
      context.pathParam('token');

    /*
     * 1. 공용 회차 토큰 검증
     */
    if (
      !publicToken ||
      publicToken.length !==
        config.PUBLIC_LINK_TOKEN_LENGTH
    ) {
      throw new NotFoundError(
        '유효하지 않은 참석 링크입니다.',
      );
    }

    const publicTokenHash =
      $security.sha256(publicToken);

    let eventRecord;

    try {
      eventRecord = $app
        .dao()
        .findFirstRecordByFilter(
          'events',
          'public_token_hash = {:tokenHash}',
          {
            tokenHash: publicTokenHash,
          },
        );
    } catch {
      throw new NotFoundError(
        '유효하지 않은 참석 링크입니다.',
      );
    }

    if (
      !eventRecord.getBool(
        'public_access_enabled',
      )
    ) {
      throw new NotFoundError(
        '비활성화된 참석 링크입니다.',
      );
    }

    const publicExpiresAt =
      eventRecord.getString(
        'public_expires_at',
      );

    if (
      !publicExpiresAt ||
      new Date(publicExpiresAt).getTime() <=
        Date.now()
    ) {
      throw new NotFoundError(
        '만료된 참석 링크입니다.',
      );
    }

    if (
      eventRecord.getString('status') ===
      'archived'
    ) {
      throw new NotFoundError(
        '종료된 참석 링크입니다.',
      );
    }

    /*
     * 2. 요청 body 확인
     */
    const requestData = new DynamicModel({
      name: '',
      phone: '',
    });

    context.bind(requestData);

    const name = String(
      requestData.name || '',
    ).trim();

    const phoneDigits = String(
      requestData.phone || '',
    ).replace(/[^0-9]/g, '');

    // 사용자 존재 여부 추측을 막기 위해
    // 형식 오류와 회원 불일치에 같은 메시지를 사용합니다.
    const identityErrorMessage =
      '입력한 정보와 일치하는 회원을 찾을 수 없습니다.';

    if (
      !name ||
      phoneDigits.length !== 11 ||
      phoneDigits.slice(0, 3) !== '010'
    ) {
      throw new BadRequestError(
        identityErrorMessage,
      );
    }

    const formattedPhone =
      phoneDigits.slice(0, 3) +
      '-' +
      phoneDigits.slice(3, 7) +
      '-' +
      phoneDigits.slice(7, 11);

    /*
     * 3. 이름과 연락처가 모두 일치하는 활성 회원 조회
     */
    const matchingMembers = $app
      .dao()
      .findRecordsByFilter(
        'members',
        [
          'name = {:name}',
          'phone = {:phone}',
          'status = {:status}',
        ].join(' && '),
        '',
        2,
        0,
        {
          name,
          phone: formattedPhone,
          status: 'active',
        },
      );

    // 0명뿐 아니라 중복 회원이 있어도 본인 확인 실패
    if (matchingMembers.length !== 1) {
      throw new BadRequestError(
        identityErrorMessage,
      );
    }

    const memberRecord =
      matchingMembers[0];

    /*
     * 4. 기존 참석자 조회
     */
    let participantRecord = null;

    try {
      participantRecord = $app
        .dao()
        .findFirstRecordByFilter(
          'event_participants',
          [
            'event = {:eventId}',
            'member = {:memberId}',
          ].join(' && '),
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
      const participantsCollection =
        $app
          .dao()
          .findCollectionByNameOrId(
            'event_participants',
          );

      participantRecord = new Record(
        participantsCollection,
      );

      const nickname =
        memberRecord
          .getString('nickname')
          .trim();

      const memberName =
        memberRecord
          .getString('name')
          .trim();

      participantRecord.set(
        'event',
        eventRecord.id,
      );

      participantRecord.set(
        'participant_type',
        'member',
      );

      participantRecord.set(
        'member',
        memberRecord.id,
      );

      participantRecord.set(
        'guest_name',
        '',
      );

      participantRecord.set(
        'display_name',
        nickname || memberName,
      );

      participantRecord.set(
        'rank_snapshot',
        memberRecord.getInt('rank'),
      );

      participantRecord.set(
        'game_participation_status',
        'undecided',
      );

      participantRecord.set(
        'participation_responded_at',
        '',
      );

      participantRecord.set(
        'version',
        1,
      );
    } else {
      participantRecord.set(
        'version',
        participantRecord.getInt(
          'version',
        ) + 1,
      );
    }

    /*
     * 6. 참가자 본인 응답용 개인 토큰 발급
     *
     * 본인 확인을 다시 하면 이전 개인 토큰은
     * 즉시 무효화됩니다.
     */
    const responseToken =
      $security.randomString(
        config.PARTICIPATION_TOKEN_LENGTH,
      );

    participantRecord.set(
      'participation_token_hash',
      $security.sha256(responseToken),
    );

    $app
      .dao()
      .saveRecord(participantRecord);

    return context.json(200, {
      responseToken,
      participant: {
        displayName:
          participantRecord.getString(
            'display_name',
          ),
        rank:
          participantRecord.getInt(
            'rank_snapshot',
          ),
        gameParticipationStatus:
          participantRecord.getString(
            'game_participation_status',
          ),
      },
    });
  },
);

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
routerAdd(
  'PATCH',
  '/api/somoim/public/participants/game-status',
  (context) => {
    const config = require(
      `${__hooks}/config.js`,
    );

    const requestData = new DynamicModel({
      responseToken: '',
      gameParticipationStatus: '',
    });

    context.bind(requestData);

    const responseToken = String(
      requestData.responseToken || '',
    ).trim();

    const gameParticipationStatus = String(
      requestData.gameParticipationStatus || '',
    ).trim();

    /*
     * 참가자는 게임 참가 또는 미참가만 선택합니다.
     * 미정 상태는 응답하기 전의 상태입니다.
     */
    if (
      gameParticipationStatus !== 'playing' &&
      gameParticipationStatus !== 'not_playing'
    ) {
      throw new BadRequestError(
        '게임 참가 여부를 선택해 주세요.',
      );
    }

    if (
      !responseToken ||
      responseToken.length !==
        config.PARTICIPATION_TOKEN_LENGTH
    ) {
      throw new NotFoundError(
        '유효하지 않은 본인 확인 정보입니다.',
      );
    }

    const responseTokenHash =
      $security.sha256(responseToken);

    /*
     * 개인 토큰으로 참가자 한 명만 조회합니다.
     */
    let participantRecord;

    try {
      participantRecord = $app
        .dao()
        .findFirstRecordByFilter(
          'event_participants',
          'participation_token_hash = {:tokenHash}',
          {
            tokenHash: responseTokenHash,
          },
        );
    } catch {
      throw new NotFoundError(
        '유효하지 않은 본인 확인 정보입니다.',
      );
    }

    /*
     * 참가자가 속한 회차를 확인합니다.
     */
    const eventId =
      participantRecord.getString('event');

    let eventRecord;

    try {
      eventRecord = $app
        .dao()
        .findRecordById(
          'events',
          eventId,
        );
    } catch {
      throw new NotFoundError(
        '회차 정보를 찾을 수 없습니다.',
      );
    }

    if (
      !eventRecord.getBool(
        'public_access_enabled',
      )
    ) {
      throw new NotFoundError(
        '비활성화된 참석 링크입니다.',
      );
    }

    const expiresAt =
      eventRecord.getString(
        'public_expires_at',
      );

    if (
      !expiresAt ||
      new Date(expiresAt).getTime() <=
        Date.now()
    ) {
      throw new NotFoundError(
        '참석 응답 기간이 만료됐습니다.',
      );
    }

    if (
      eventRecord.getString('status') ===
      'archived'
    ) {
      throw new NotFoundError(
        '종료된 회차입니다.',
      );
    }

    /*
     * 게임 참가 상태와 응답 시간을 저장합니다.
     */
    const respondedAt =
      new Date().toISOString();

    participantRecord.set(
      'game_participation_status',
      gameParticipationStatus,
    );

    participantRecord.set(
      'participation_responded_at',
      respondedAt,
    );

    participantRecord.set(
      'version',
      participantRecord.getInt(
        'version',
      ) + 1,
    );

    $app
      .dao()
      .saveRecord(participantRecord);

    return context.json(200, {
      participant: {
        displayName:
          participantRecord.getString(
            'display_name',
          ),
        rank:
          participantRecord.getInt(
            'rank_snapshot',
          ),
        gameParticipationStatus:
          participantRecord.getString(
            'game_participation_status',
          ),
      },
      respondedAt,
    });
  },
);