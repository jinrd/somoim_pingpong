import { pb } from '../../lib/pocketbase';
import { DOMAIN_LIMITS } from '../../config/domain';
import {
  getMembers,
  getRankSettings,
  type Member,
  type RankSettingsInput,
} from '../members/api';

import type {
  AddGuestInput,
  AddMembersResult,
  CreateEventInput,
  EventParticipant,
  EventParticipantWithMember,
  GameParticipationStatus,
  SomoimEvent,
  UpdateEventInput,
} from './types';

const EVENTS_COLLECTION = 'events';
const PARTICIPANTS_COLLECTION = 'event_participants';

/**
 * HTML date input의 YYYY-MM-DD 값을 PocketBase date 형식으로 변환합니다.
 */
const toPocketBaseDate = (date: string): string => {
    const trimmedDate = date.trim();

    if(!trimmedDate) {
        throw new Error('회차 날짜를 입력해 주세요.');
    }
    const parsedDate = new Date(`${trimmedDate}T00:00:00`);

    if (Number.isNaN(parsedDate.getTime())) {
       throw new Error('올바른 날짜를 입력해 주세요.');
    }

    return parsedDate.toISOString();
};

const validateTitle = (title: string): string => {
  const trimmedTitle = title.trim();

  if (!trimmedTitle) {
    throw new Error('회차 제목을 입력해 주세요.');
  }

  if (trimmedTitle.length > DOMAIN_LIMITS.eventTitleMaxLength) {
    throw new Error(
      `회차 제목은 ${DOMAIN_LIMITS.eventTitleMaxLength}자 이하로 입력해 주세요.`,
    );
  }

  return trimmedTitle;
};

const validateNotice = (notice: string): string => {
  const trimmedNotice = notice.trim();

  if (
    trimmedNotice.length >
    DOMAIN_LIMITS.eventNoticeMaxLength
  ) {
    throw new Error(
      `공지사항은 ${DOMAIN_LIMITS.eventNoticeMaxLength}자 이하로 입력해 주세요.`,
    );
  }

  return trimmedNotice;
};

const validateRank = (
  rank: number,
  settings: RankSettingsInput,
): number => {
  if (!Number.isInteger(rank)) {
    throw new Error('부수는 정수로 입력해 주세요.');
  }

  if (
    rank < settings.min_rank ||
    rank > settings.max_rank
  ) {
    throw new Error(
      `부수는 ${settings.min_rank}부터 ${settings.max_rank} 사이로 입력해 주세요.`,
    );
  }

  return rank;
};

/**
 * 회차 목록을 최신 날짜순으로 가져옵니다.
 */
export const getEvents = async (): Promise<SomoimEvent[]> => {
  return pb.collection(EVENTS_COLLECTION).getFullList<SomoimEvent>({
    sort: '-event_date,-created',
  });
};

/**
 * ID로 회차 한 건을 가져옵니다.
 */
export const getEvent = async (eventId: string): Promise<SomoimEvent> => {
    return pb.collection(EVENTS_COLLECTION).getOne<SomoimEvent>(eventId);
}

/**
 * 새 회차를 생성한다.
 */
export const createEvent = async (
  input: CreateEventInput,
): Promise<SomoimEvent> => {
  const operatorId = pb.authStore.record?.id;

  if (!operatorId) {
    throw new Error('로그인이 필요합니다.');
  }

  const data = {
    title: validateTitle(input.title),
    event_date: toPocketBaseDate(input.eventDate),
    status: input.status ?? 'draft',
    notice: validateNotice(input.notice ?? ''),

    public_token_hash: '',
    public_access_enabled: false,
    public_expires_at: '',

    created_by: operatorId,
    version: 1,
  };

  return pb
    .collection(EVENTS_COLLECTION)
    .create<SomoimEvent>(data);
};


/**
 * 회차 정보를 수정합니다.
 *
 * expectedVersion은 화면에서 조회했을 당시의 version입니다.
 * 현재 서버 version과 다르면 다른 운영진이 먼저 수정한 것으로 처리합니다.
 *
 * PocketBase 일반 Record API만 사용하는 현재 구현은
 * 조회와 수정 사이가 완전히 원자적이지는 않습니다.
 * 추후 서버 hook에서 조건부 update로 강화할 수 있습니다.
 */
export const updateEvent = async (
    eventId: string,
    input: UpdateEventInput,
    expectedVersion: number,
): Promise<SomoimEvent> => {
    const currentEvent = await getEvent(eventId);

    if(currentEvent.version !== expectedVersion) {
        throw new Error(
            '다른 운영진이 먼저 회차를 수정했습니다. 최신 정보를 다시 불러와 주세요.'
        );
    }

    const data: Record<string, string | number> = {
        version: currentEvent.version + 1,
    }


    if (input.title !== undefined) {
        data.title = validateTitle(input.title);
    }

    if (input.eventDate !== undefined) {
        data.event_date = toPocketBaseDate(input.eventDate);
    }

    if (input.status !== undefined) {
        data.status = input.status;
    }

    if (input.notice !== undefined) {
        data.notice = validateNotice(input.notice);
    }
    return pb
        .collection(EVENTS_COLLECTION)
        .update<SomoimEvent>(eventId, data);

}

/**
 * 회차를 물리적으로 삭제하지 않고 archived 상태로 변경합니다.
 */
export const archiveEvent = async (
  eventId: string,
  expectedVersion: number,
): Promise<SomoimEvent> => {
  return updateEvent(
    eventId,
    {
      status: 'archived',
    },
    expectedVersion,
  );
};


/**
 * 특정 회차의 참석자 목록을 가져옵니다.
 *
 * expand: 'member'를 사용하면 기존 회원인 경우
 * 참가자 데이터와 회원 데이터를 함께 받을 수 있습니다.
 */
export const getEventParticipants = async (eventId: string) : Promise<EventParticipantWithMember[]> => {
    return pb.collection(PARTICIPANTS_COLLECTION)
    .getFullList<EventParticipantWithMember>({
      filter: pb.filter(
        'event = {:eventId}',
        {
          eventId,
        },
      ),
      expand: 'member',
      sort: 'display_name',
    });
}

/**
 * 참석자로 아직 등록되지 않은 활성 회원을 가져온다.
 */
export const getAvailableMembers = async (eventId: string) : Promise<Member[]> => {
    const [members, participants] = await Promise.all([
        getMembers(), getEventParticipants(eventId),
    ])

    const registeredMemberIds = new Set(
        participants.filter(
            (participant) => 
                participant.participant_type === 'member' &&
            Boolean(participant.member),
        ).map((participant) => participant.member)
    );

    return members.filter(
        (member) => member.status === 'active' && !registeredMemberIds.has(member.id)
    )
}


/**
 * 기존 회원 여러 명을 회차 참석자로 추가합니다.
 *
 * 이미 등록된 회원은 오류를 발생시키지 않고 skipped로 반환합니다.
 */
export const addMembersToEvent = async (
    eventId: string,
    members: Member[],
    gameParticipationStatus: GameParticipationStatus = 'undecided',
): Promise<AddMembersResult> => {
    if(members.length === 0) {
        return {
            added: [],
            skipped: [],
        }
    }

    const existingParticipants = await getEventParticipants(eventId);
    const rankSettings = await getRankSettings();

    if (!rankSettings) {
      throw new Error('부수 설정을 찾을 수 없습니다.');
    }

    const existingMemberIds = new Set(
        existingParticipants.filter(
            (participant) =>
                participant.participant_type === 'member' &&
            Boolean(participant.member),
        ).map((participant) => participant.member)
    );

    const result: AddMembersResult = {
        added: [],
        skipped: [],
    };

    for (const member of members ){
        if(existingMemberIds.has(member.id)) {
            result.skipped.push(member);
            continue;
        }
        const participant = await pb
            .collection(PARTICIPANTS_COLLECTION)
            .create<EventParticipant>({
                event: eventId,

                participant_type: 'member',
                member: member.id,
                guest_name: '',

                display_name:
                member.nickname.trim() ||
                member.name.trim(),

                rank_snapshot: validateRank(
                  member.rank,
                  rankSettings,
                ),

                game_participation_status:
                gameParticipationStatus,

                participation_token_hash: '',
                participation_responded_at: '',

                version: 1,
            });

        result.added.push(participant);
        existingMemberIds.add(member.id);
    }

    return result;
}

/**
 * 일회성 게스트를 참석자로 추가합니다.
 */
export const addGuestToEvent = async (
    eventId: string,
    input: AddGuestInput,
): Promise<EventParticipant> => {
    const guestName = input.name.trim();

    if(!guestName) {
        throw new Error("게스트 이름을 입력해 주세요");
    }

    if(
      guestName.length >
      DOMAIN_LIMITS.guestNameMaxLength
    ) {
      throw new Error(
        `게스트 이름은 ${DOMAIN_LIMITS.guestNameMaxLength}자 이하로 입력해 주세요.`,
      );
    }

    const rankSettings = await getRankSettings();

    if (!rankSettings) {
      throw new Error('부수 설정을 찾을 수 없습니다.');
    }

    return pb
    .collection(PARTICIPANTS_COLLECTION)
    .create<EventParticipant>({
      event: eventId,

      participant_type: 'guest',
      member: '',
      guest_name: guestName,
      display_name: guestName,

      rank_snapshot: validateRank(
        input.rank,
        rankSettings,
      ),

      game_participation_status:
        input.gameParticipationStatus ?? 'undecided',

      participation_token_hash: '',
      participation_responded_at: '',

      version: 1,
    });
}

/**
 * 참석자의 게임 참가 상태를 변경한다.
 */
export const updateGameParticipationStatus = async (
  participantId: string,
  status: GameParticipationStatus,
  expectedVersion: number,
): Promise<EventParticipant> => {
  const currentParticipant = await pb
    .collection(PARTICIPANTS_COLLECTION)
    .getOne<EventParticipant>(participantId);

  if (currentParticipant.version !== expectedVersion) {
    throw new Error(
      '다른 운영진이 먼저 참가 상태를 변경했습니다. 최신 정보를 다시 불러와 주세요.',
    );
  }

  return pb
    .collection(PARTICIPANTS_COLLECTION)
    .update<EventParticipant>(
      participantId,
      {
        game_participation_status: status,
        version: currentParticipant.version + 1,
      },
    );
};

/**
 * 회차 참석자에서 제거합니다.
 *
 * 회원 자체를 삭제하는 것이 아니라
 * event_participants Record만 삭제합니다.
 */
export const removeEventParticipant = async (
  participantId: string,
): Promise<void> => {
  await pb
    .collection(PARTICIPANTS_COLLECTION)
    .delete(participantId);
};
