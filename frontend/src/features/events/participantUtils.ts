import { ClientResponseError } from "pocketbase";

import type { Member } from "../members/api";
import type { EventParticipantWithMember } from "./types";

export const isInactiveMember = (
  participant: EventParticipantWithMember,
): boolean =>
  participant.participant_type === "member" &&
  participant.expand?.member?.status === "inactive";

export const getParticipantTypeLabel = (
  participant: EventParticipantWithMember,
): string => {
  if (isInactiveMember(participant)) {
    return "비활동 회원";
  }

  return participant.participant_type === "guest" ? "게스트" : "회원";
};

export const getParticipantErrorMessage = (
  error: unknown,
  fallback: string,
): string => {
  if (error instanceof ClientResponseError) {
    return error.response?.message || error.message || fallback;
  }

  return error instanceof Error ? error.message : fallback;
};

export const excludeRegisteredMembers = (
  members: Member[],
  participants: EventParticipantWithMember[],
): Member[] => {
  const registeredMemberIds = new Set(
    participants
      .filter(
        (participant) =>
          participant.participant_type === "member" &&
          Boolean(participant.member),
      )
      .map((participant) => participant.member),
  );

  return members.filter(
    (member) =>
      member.status === "active" && !registeredMemberIds.has(member.id),
  );
};
