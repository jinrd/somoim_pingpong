import { useCallback, useEffect, useMemo, useState } from "react";

import { RefreshCw, Search, Trash2, UserPlus, Users } from "lucide-react";
import { ClientResponseError } from "pocketbase";

import { DEFAULT_RANK_SETTINGS } from "../../config/domain";
import {
  getMembers,
  getRankSettings,
  type Member,
  type RankSettingsInput,
} from "../members/api";
import {
  addMembersToEvent,
  checkMatchIntegrity,
  closeEventParticipation,
  getEventParticipants,
  removeEventParticipant,
  updateGameParticipationStatus,
} from "./api";
import GuestFormModal from "./GuestFormModal";
import {
  GAME_PARTICIPATION_STATUS_LABELS,
  type EventParticipantWithMember,
  type GameParticipationStatus,
  type SomoimEvent,
} from "./types";

import styles from "./Events.module.css";

interface Props {
  eventRecord: SomoimEvent;
  hasGameConfiguration: boolean;
  onEventUpdated: (eventRecord: SomoimEvent) => void;
  onGameConfigurationReset: () => void;
}

const isInactiveMember = (participant: EventParticipantWithMember): boolean =>
  participant.participant_type === "member" &&
  participant.expand?.member?.status === "inactive";

const getParticipantTypeLabel = (
  participant: EventParticipantWithMember,
): string => {
  if (isInactiveMember(participant)) {
    return "비활동 회원";
  }

  return participant.participant_type === "guest" ? "게스트" : "회원";
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof ClientResponseError) {
    return error.response?.message || error.message || fallback;
  }

  return error instanceof Error ? error.message : fallback;
};

const excludeRegisteredMembers = (
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

export default function ParticipantManager({
  eventRecord,
  hasGameConfiguration,
  onEventUpdated,
  onGameConfigurationReset,
}: Props) {
  const eventId = eventRecord.id;
  const isParticipationClosed =
    eventRecord.participation_status === "closed";

  const [participants, setParticipants] = useState<
    EventParticipantWithMember[]
  >([]);
  const [availableMembers, setAvailableMembers] = useState<Member[]>([]);
  const [rankSettings, setRankSettings] = useState<RankSettingsInput>(
    DEFAULT_RANK_SETTINGS,
  );
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [searchKeyword, setSearchKeyword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState("");
  const [isGuestModalOpen, setGuestModalOpen] = useState(false);
  const [hasStartedMatches, setHasStartedMatches] = useState(false);

  const refreshParticipants = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [participantRecords, memberRecords, settings, integrity] =
        await Promise.all([
          getEventParticipants(eventId),
          getMembers(),
          getRankSettings(),
          checkMatchIntegrity(eventId),
        ]);

      setParticipants(participantRecords);
      setAvailableMembers(
        excludeRegisteredMembers(memberRecords, participantRecords),
      );
      setRankSettings(settings ?? DEFAULT_RANK_SETTINGS);
      setSelectedMemberIds(new Set());
      setHasStartedMatches(integrity.hasInProgressOrCompletedMatches);
    } catch {
      setError("참석자 정보를 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshParticipants();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [refreshParticipants]);

  const filteredMembers = useMemo(() => {
    const normalizedKeyword = searchKeyword.trim().toLowerCase();

    if (!normalizedKeyword) {
      return availableMembers;
    }

    return availableMembers.filter(
      (member) =>
        member.name.toLowerCase().includes(normalizedKeyword) ||
        member.nickname.toLowerCase().includes(normalizedKeyword),
    );
  }, [availableMembers, searchKeyword]);

  const playingCount = participants.filter(
    (participant) => participant.game_participation_status === "playing",
  ).length;
  const notPlayingCount = participants.filter(
    (participant) => participant.game_participation_status === "not_playing",
  ).length;
  const undecidedCount = participants.filter(
    (participant) => participant.game_participation_status === "undecided",
  ).length;

  const toggleMemberSelection = (memberId: string) => {
    setSelectedMemberIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextIds.has(memberId)) {
        nextIds.delete(memberId);
      } else {
        nextIds.add(memberId);
      }

      return nextIds;
    });
  };

  const handleAddSelectedMembers = async () => {
    const selectedMembers = availableMembers.filter((member) =>
      selectedMemberIds.has(member.id),
    );

    if (selectedMembers.length === 0) {
      setError("추가할 회원을 선택해 주세요.");
      return;
    }

    setIsWorking(true);
    setError("");

    try {
      await addMembersToEvent(eventId, selectedMembers);
      await refreshParticipants();
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "참석자를 추가하지 못했습니다."));
    } finally {
      setIsWorking(false);
    }
  };

  const handleCloseParticipation = async () => {
    if (undecidedCount > 0) {
      setError(
        `참가 상태가 미정인 참석자 ${undecidedCount}명이 있습니다. 모두 확정한 후 마감해 주세요.`,
      );
      return;
    }

    const shouldClose = window.confirm(
      "참가 신청을 최종 마감할까요?\n\n마감 후에는 다시 열 수 없으며 참석자를 추가하거나 삭제할 수 없습니다. 운영진은 기존 참석자의 게임 참가/미참가 상태만 변경할 수 있습니다.",
    );

    if (!shouldClose) {
      return;
    }

    setIsWorking(true);
    setError("");

    try {
      const result = await closeEventParticipation(
        eventId,
        eventRecord.version,
      );

      onEventUpdated({
        ...eventRecord,
        ...result,
      });
    } catch (caughtError) {
      setError(
        getErrorMessage(caughtError, "참가 신청을 마감하지 못했습니다."),
      );
    } finally {
      setIsWorking(false);
    }
  };

  const handleStatusChange = async (
    participant: EventParticipantWithMember,
    status: GameParticipationStatus,
  ) => {
    if (participant.game_participation_status === status) {
      return;
    }

    if (isInactiveMember(participant) && status === "playing") {
      setError("비활동 회원은 게임 참가 상태로 변경할 수 없습니다.");
      return;
    }

    if (hasStartedMatches) {
      setError("이미 시작했거나 완료된 경기가 있어 참가 상태를 변경할 수 없습니다.");
      return;
    }

    let confirmReset = false;

    if (isParticipationClosed && hasGameConfiguration) {
      confirmReset = window.confirm(
        `${participant.display_name}님의 참가 상태를 변경할까요?\n\n저장된 게임 설정, 세부 경기, 팀 편성, 대진표와 라인업이 모두 초기화됩니다. 참가 신청 마감 상태는 유지됩니다.`,
      );

      if (!confirmReset) {
        return;
      }
    }

    setIsWorking(true);
    setError("");

    try {
      let result;

      try {
        result = await updateGameParticipationStatus(
          participant.id,
          status,
          participant.version,
          confirmReset,
        );
      } catch (caughtError) {
        const resetRequired =
          caughtError instanceof ClientResponseError &&
          Boolean(caughtError.response?.data?.resetRequired);

        if (
          !confirmReset &&
          resetRequired &&
          window.confirm(
            `${participant.display_name}님의 참가 상태를 변경할까요?\n\n서버에 저장된 게임 설정, 세부 경기, 팀 편성, 대진표와 라인업이 모두 초기화됩니다. 참가 신청 마감 상태는 유지됩니다.`,
          )
        ) {
          result = await updateGameParticipationStatus(
            participant.id,
            status,
            participant.version,
            true,
          );
        } else {
          throw caughtError;
        }
      }

      setParticipants((currentParticipants) =>
        currentParticipants.map((currentParticipant) =>
          currentParticipant.id === result.participant.id
            ? {
                ...currentParticipant,
                ...result.participant,
                expand: currentParticipant.expand,
              }
            : currentParticipant,
        ),
      );

      if (result.gameConfigurationReset) {
        onGameConfigurationReset();
      }
    } catch (caughtError) {
      setError(
        getErrorMessage(caughtError, "게임 참가 상태를 변경하지 못했습니다."),
      );
    } finally {
      setIsWorking(false);
    }
  };

  const handleRemoveParticipant = async (
    participant: EventParticipantWithMember,
  ) => {
    if (isParticipationClosed) {
      setError(
        "참가 신청이 최종 마감되어 참석자를 제거할 수 없습니다. 게임에 참여하지 않는 경우 게임 미참가로 변경해 주세요.",
      );
      return;
    }

    if (
      !window.confirm(
        `${participant.display_name}님을 참석자 명단에서 제거할까요?`,
      )
    ) {
      return;
    }

    setIsWorking(true);
    setError("");

    try {
      await removeEventParticipant(participant.id);
      await refreshParticipants();
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "참석자를 제거하지 못했습니다."));
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <section className={styles.participantSection}>
      <div className={styles.participantSummaryGrid}>
        <div className={styles.summaryCard}>
          <span>전체 참석자</span>
          <strong>{participants.length}</strong>
        </div>
        <div className={styles.summaryCard}>
          <span>게임 참가</span>
          <strong>{playingCount}</strong>
        </div>
        <div className={styles.summaryCard}>
          <span>게임 미참가</span>
          <strong>{notPlayingCount}</strong>
        </div>
        <div className={styles.summaryCard}>
          <span>미정</span>
          <strong>{undecidedCount}</strong>
        </div>
      </div>

      {error && (
        <div className={styles.errorPanel} role="alert">
          <p>{error}</p>
          <button
            type="button"
            className={styles.retryButton}
            onClick={() => void refreshParticipants()}
            disabled={isLoading || isWorking}
          >
            <RefreshCw size={17} aria-hidden="true" />
            다시 불러오기
          </button>
        </div>
      )}

      {hasStartedMatches ? (
        <div className={styles.errorPanel} role="alert">
          <p>
            경기가 시작되었습니다. 참석자 상태와 경기 구성은 더 이상 변경할 수
            없습니다.
          </p>
        </div>
      ) : isParticipationClosed ? (
        <div className={styles.workflowNotice}>
          <strong>참가 신청이 최종 마감되었습니다.</strong>
          <p>
            참석자 추가·삭제는 할 수 없습니다. 기존 참석자는 게임 참가 또는
            게임 미참가로만 변경할 수 있으며, 경기 구성이 있으면 변경 시 모두
            초기화됩니다.
          </p>
        </div>
      ) : (
        <div className={styles.workflowNotice}>
          <strong>참가 신청 접수 중</strong>
          <p>
            미정인 참석자가 없을 때 최종 마감할 수 있습니다. 마감은 취소하거나
            다시 열 수 없습니다.
          </p>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={isWorking || isLoading || undecidedCount > 0}
            onClick={() => void handleCloseParticipation()}
          >
            참가 신청 최종 마감
          </button>
        </div>
      )}

      <div
        className={`${styles.participantLayout} ${
          isParticipationClosed ? styles.participantLayoutClosed : ""
        }`}
      >
        {!isParticipationClosed && (
          <section className={styles.memberPicker}>
            <div className={styles.panelHeader}>
              <div>
                <h2>회원 추가</h2>
                <p>이번 회차에 참석하는 회원을 선택하세요.</p>
              </div>
            </div>

            <div className={styles.searchBox}>
              <Search size={18} aria-hidden="true" />
              <input
                type="search"
                value={searchKeyword}
                placeholder="이름 또는 닉네임 검색"
                aria-label="참석 가능 회원 검색"
                onChange={(changeEvent) => {
                  setSearchKeyword(changeEvent.target.value);
                }}
              />
            </div>

            <div className={styles.memberSelectionList}>
              {isLoading ? (
                <p className={styles.panelEmpty}>회원 목록을 불러오는 중입니다…</p>
              ) : filteredMembers.length === 0 ? (
                <p className={styles.panelEmpty}>
                  추가할 수 있는 회원이 없습니다.
                </p>
              ) : (
                filteredMembers.map((member) => (
                  <label key={member.id} className={styles.memberSelectionItem}>
                    <input
                      type="checkbox"
                      checked={selectedMemberIds.has(member.id)}
                      onChange={() => toggleMemberSelection(member.id)}
                    />
                    <span className={styles.memberAvatar} aria-hidden="true">
                      {member.nickname.trim().slice(0, 1)}
                    </span>
                    <span className={styles.memberSelectionContent}>
                      <strong>{member.nickname}</strong>
                      <small>
                        {member.name} · {member.rank}부
                      </small>
                    </span>
                  </label>
                ))
              )}
            </div>

            <div className={styles.pickerActions}>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => void handleAddSelectedMembers()}
                disabled={isWorking || selectedMemberIds.size === 0}
              >
                <UserPlus size={18} aria-hidden="true" />
                선택한 회원 {selectedMemberIds.size}명 추가
              </button>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={() => setGuestModalOpen(true)}
                disabled={isWorking}
              >
                게스트 추가
              </button>
            </div>
          </section>
        )}

        <section className={styles.participantPanel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>현재 참석자</h2>
              <p>팀 편성과 대진에는 게임 참가 상태인 사람만 포함됩니다.</p>
            </div>
            <Users size={22} aria-hidden="true" />
          </div>

          <div className={styles.participantList}>
            {isLoading ? (
              <p className={styles.panelEmpty}>
                참석자 목록을 불러오는 중입니다…
              </p>
            ) : participants.length === 0 ? (
              <p className={styles.panelEmpty}>아직 등록된 참석자가 없습니다.</p>
            ) : (
              participants.map((participant) => (
                <article
                  key={participant.id}
                  className={styles.participantItem}
                >
                  <div className={styles.participantIdentity}>
                    <span className={styles.memberAvatar} aria-hidden="true">
                      {participant.display_name.trim().slice(0, 1)}
                    </span>
                    <div>
                      <strong>{participant.display_name}</strong>
                      <small>
                        {participant.rank_snapshot}부 ·{" "}
                        {getParticipantTypeLabel(participant)}
                      </small>
                    </div>
                  </div>

                  <div className={styles.participantControls}>
                    <select
                      className={styles.statusSelect}
                      value={participant.game_participation_status}
                      disabled={
                        isWorking ||
                        hasStartedMatches ||
                        (isInactiveMember(participant) &&
                          participant.game_participation_status ===
                            "not_playing")
                      }
                      aria-label={`${participant.display_name} 게임 참가 상태`}
                      onChange={(changeEvent) =>
                        void handleStatusChange(
                          participant,
                          changeEvent.target.value as GameParticipationStatus,
                        )
                      }
                    >
                      {Object.entries(
                        GAME_PARTICIPATION_STATUS_LABELS,
                      ).map(([value, label]) =>
                        !isParticipationClosed || value !== "undecided" ? (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ) : null,
                      )}
                    </select>

                    <button
                      type="button"
                      className={styles.removeButton}
                      onClick={() => void handleRemoveParticipant(participant)}
                      disabled={
                        isWorking || hasStartedMatches || isParticipationClosed
                      }
                      aria-label={`${participant.display_name} 참석자 제거`}
                      title={
                        isParticipationClosed
                          ? "참가 신청 마감 후에는 참석자를 제거할 수 없습니다."
                          : undefined
                      }
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      {isGuestModalOpen && !isParticipationClosed && (
        <GuestFormModal
          eventId={eventId}
          rankSettings={rankSettings}
          onClose={() => setGuestModalOpen(false)}
          onCreated={() => void refreshParticipants()}
        />
      )}
    </section>
  );
}
