import type {
  PublicParticipantMatch,
  PublicTeamMatchStatus,
} from "./types";

const STATUS_LABELS: Record<PublicTeamMatchStatus, string> = {
  scheduled: "경기 준비",
  ready: "경기 시작 대기",
  in_progress: "경기 진행 중",
  completed: "경기 완료",
  cancelled: "경기 취소",
};

export const getPublicMatchStatusLabel = (
  status: PublicTeamMatchStatus,
): string => {
  return STATUS_LABELS[status];
};

export const getPublicMatchPriority = (
  status: PublicTeamMatchStatus,
): number => {
  if (status === "in_progress") {
    return 0;
  }

  if (status === "ready") {
    return 1;
  }

  if (status === "scheduled") {
    return 2;
  }

  return 3;
};

export interface PublicMatchGroups {
  inProgress: PublicParticipantMatch[];
  upcoming: PublicParticipantMatch[];
  completed: PublicParticipantMatch[];
  cancelled: PublicParticipantMatch[];
}

export const groupPublicMatches = (
  matches: PublicParticipantMatch[],
): PublicMatchGroups => {
  const groups: PublicMatchGroups = {
    inProgress: [],
    upcoming: [],
    completed: [],
    cancelled: [],
  };

  matches.forEach((match) => {
    if (match.status === "in_progress") {
      groups.inProgress.push(match);
      return;
    }

    if (match.status === "cancelled") {
      groups.cancelled.push(match);
      return;
    }

    if (match.status === "completed") {
      groups.completed.push(match);
      return;
    }

    groups.upcoming.push(match);
  });

  return groups;
};

export const hasOpenPublicMatches = (
  matches: PublicParticipantMatch[],
): boolean => {
  return matches.some(
    (match) =>
      match.status !== "completed" && match.status !== "cancelled",
  );
};

export const canOpenPublicMatchResult = (
  status: PublicTeamMatchStatus,
): boolean => {
  return status === "in_progress" || status === "completed";
};
