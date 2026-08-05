import type { PublicIdentityResult } from "./types";

const getStorageKey = (publicToken: string): string =>
  `event-participant:${publicToken}`;

const isPublicIdentityResult = (
  value: unknown,
): value is PublicIdentityResult => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const identity = value as Partial<PublicIdentityResult>;

  return Boolean(
    identity.responseToken &&
    identity.competitionType &&
    identity.participant &&
    typeof identity.participant.displayName === "string",
  );
};

export const loadPublicIdentity = (
  publicToken?: string,
): PublicIdentityResult | null => {
  if (!publicToken) {
    return null;
  }

  try {
    const storedValue = sessionStorage.getItem(getStorageKey(publicToken));

    if (!storedValue) {
      return null;
    }

    const parsedValue: unknown = JSON.parse(storedValue);

    if (!isPublicIdentityResult(parsedValue)) {
      sessionStorage.removeItem(getStorageKey(publicToken));
      return null;
    }

    return parsedValue;
  } catch {
    sessionStorage.removeItem(getStorageKey(publicToken));
    return null;
  }
};

export const savePublicIdentity = (
  publicToken: string,
  identity: PublicIdentityResult,
): void => {
  try {
    sessionStorage.setItem(
      getStorageKey(publicToken),
      JSON.stringify(identity),
    );
  } catch {
    // 저장소가 차단된 브라우저에서도 현재 화면의 본인 확인은 유지합니다.
  }
};

export const removePublicIdentity = (publicToken: string): void => {
  try {
    sessionStorage.removeItem(getStorageKey(publicToken));
  } catch {
    // 저장소 접근 실패가 화면 전환을 막지 않도록 무시합니다.
  }
};
