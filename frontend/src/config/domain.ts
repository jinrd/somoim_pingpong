import type { RankSettingsInput } from "../features/members/api";

/**
 * 운영 중 변경하는 값은 rank_settings에 저장합니다.
 * 아래 값은 설정 레코드가 아직 없을 때만 사용하는 초기값입니다.
 */
export const DEFAULT_RANK_SETTINGS: RankSettingsInput = {
  min_rank: 0,
  max_rank: 8,
  default_member_rank: 8,
  default_guest_rank: 8,
  promotion_threshold: 3,
  demotion_threshold: 4,
};

/**
 * DB 스키마와 함께 유지하는 기술적 제한입니다.
 * 운영자가 설정 화면에서 변경하는 값과 구분합니다.
 */
export const DOMAIN_LIMITS = {
  absoluteRankMin: 0,
  positiveCountMin: 1,
  absoluteRankMax: 99,
  eventTitleMaxLength: 150,
  eventNoticeMaxLength: 3000,
  guestNameMaxLength: 100,
  memberNameMaxLength: 100,
  memberNicknameMaxLength: 100,
  formattedPhoneLength: 13,
} as const;
