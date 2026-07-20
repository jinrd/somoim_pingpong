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
