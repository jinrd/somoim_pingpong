import type { RecordModel } from "pocketbase";
import type { Member } from "../members/api";

export type EventStatus = "draft" | "active" | "completed" | "archived";
export type ParticipationStatus = "open" | "closed";

export type ParticipantType = "member" | "guest";

export type GameParticipationStatus = "playing" | "not_playing";

export interface SomoimEvent extends RecordModel {
  title: string;
  event_date: string;
  status: EventStatus;
  notice?: string;
  participation_status: ParticipationStatus;
  participation_closed_at?: string;

  public_token_hash?: string;
  public_access_enabled: boolean;
  public_expires_at?: string;

  created_by: string;
  version: number;
}

export interface EventParticipant extends RecordModel {
  event: string;

  participant_type: ParticipantType;
  member?: string;
  guest_name?: string;
  display_name: string;

  rank_snapshot: number;

  game_participation_status: GameParticipationStatus;

  participation_token_hash?: string;
  participation_responded_at?: string;

  version: number;
}

export interface EventParticipantExpand {
  member?: Member;
}

export type EventParticipantWithMember = EventParticipant & {
  expand?: EventParticipantExpand;
};

export interface CreateEventInput {
  title: string;
  eventDate: string;
  notice?: string;
}

export interface UpdateEventInput {
  title?: string;
  eventDate?: string;
  notice?: string;
}

export interface AddGuestInput {
  name: string;
  rank: number;
  gameParticipationStatus?: GameParticipationStatus;
}

export interface AddMembersResult {
  added: EventParticipant[];
  skipped: Member[];
}

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  draft: "준비 중",
  active: "진행 중",
  completed: "경기 종료",
  archived: "보관",
};

export const GAME_PARTICIPATION_STATUS_LABELS: Record<
  GameParticipationStatus,
  string
> = {
  playing: "게임 참가",
  not_playing: "게임 미참가",
};

export interface PublicLinkIssueResult {
  token: string;
  expiresAt: string;
}

export interface PublicEventInfo {
  id: string;
  title: string;
  eventDate: string;
  notice: string;
  status: EventStatus;
  participationStatus: ParticipationStatus;
  participationClosedAt: string;
}

export interface PublicEventResponse {
  event: PublicEventInfo;
  expiresAt: string;
}

export interface AdminPublicLinkResult {
  enabled: boolean;
  recoverable: boolean;
  token: string;
  expiresAt: string;
}

export interface PublicIdentityInput {
  name: string;
  phone: string;
}

export interface PublicTeamMember {
  participantId: string;
  displayName: string;
  rankSnapshot: number;
  isRequester: boolean;
}

export interface PublicParticipantTeam {
  id: string;
  name: string;
  sortOrder: number;
  members: PublicTeamMember[];
}

export interface PublicIdentifiedParticipant {
  displayName: string;
  rank: number;
  gameParticipationStatus: GameParticipationStatus;
  hasResponded: boolean;
  team: PublicParticipantTeam | null;
}

export interface PublicIdentityResult {
  responseToken: string;
  competitionType: string;
  participant: PublicIdentifiedParticipant;
}

export type PublicGameParticipationStatus = "playing" | "not_playing";

export interface PublicParticipationUpdateInput {
  responseToken: string;
  gameParticipationStatus: PublicGameParticipationStatus;
}

export interface PublicParticipationUpdateResult {
  participant: PublicIdentifiedParticipant;
  respondedAt: string;
}

export interface CloseParticipationResult {
  participation_status: "closed";
  participation_closed_at: string;
  version: number;
}

export interface AdminParticipationUpdateResult {
  participant: EventParticipant;
  gameConfigurationReset: boolean;
}
