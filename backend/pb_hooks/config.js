module.exports = Object.freeze({
  PUBLIC_LINK_TOKEN_LENGTH: 48,
  createPublicTokenEncryptionKey: function (secret) {
    if (!secret) {
      throw new Error('PB_ENCRYPTION_KEY is required.');
    }

    // $security.encrypt()는 정확히 32자의 AES 키를 요구합니다.
    // 환경 변수 원문을 직접 자르지 않고 SHA-256으로 키를 파생합니다.
    return $security.sha256(secret).slice(0, 32);
  },
});
