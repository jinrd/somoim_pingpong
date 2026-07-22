module.exports = Object.freeze({
  PUBLIC_LINK_TOKEN_LENGTH: 48,
  PARTICIPATION_TOKEN_LENGTH: 48,

  TEAM_QUALITY_MAX_SCORE: 100,
  TEAM_QUALITY_RANK_DIFFERENCE_PENALTY: 15,
  TEAM_QUALITY_MEMBER_DIFFERENCE_PENALTY: 10,

  createPublicTokenEncryptionKey: function (secret) {
    if (!secret) {
      throw new Error("PB_ENCRYPTION_KEY is required.");
    }

    return $security.sha256(secret).slice(0, 32);
  },

  createMemberPhoneEncryptionKey: function (secret) {
    if (!secret) {
      throw new Error("PB_ENCRYPTION_KEY is required.");
    }

    return $security
      .sha256(`somoim:member-phone:encryption:${secret}`)
      .slice(0, 32);
  },

  createMemberPhoneHashKey: function (secret) {
    if (!secret) {
      throw new Error("PB_ENCRYPTION_KEY is required.");
    }

    return $security.sha256(`somoim:member-phone:lookup:${secret}`);
  },
});
