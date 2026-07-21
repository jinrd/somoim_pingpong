import { useEffect, useMemo, useState } from "react";

import { RefreshCw, Search, Trash2, UserPlus, Users } from "lucide-react";

import {
  getMembers,
  getRankSettings,
  type Member,
  type RankSettingsInput,
} from "../members/api";
import { DEFAULT_RANK_SETTINGS } from "../../config/domain";

import {
  addMembersToEvent,
  getEventParticipants,
  removeEventParticipant,
  updateGameParticipationStatus,
} from "./api";

import GuestFormModal from "./GuestFormModal";

import {
  GAME_PARTICIPATION_STATUS_LABELS,
  type EventParticipant,
  type EventParticipantWithMember,
  type GameParticipationStatus,
} from "./types";

import styles from "./Events.module.css";

interface Props {
  eventId: string;
}

const getParticipantTypeLabel = (participant: EventParticipant): string => {
  if (participant.participant_type === "guest") {
    return "게스트";
  }

  return "회원";
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

export default function ParticipantManager({ eventId }: Props) {
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

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      getEventParticipants(eventId),
      getMembers(),
      getRankSettings(),
    ])
      .then(([participantRecords, memberRecords, settings]) => {
        if (cancelled) {
          return;
        }

        setParticipants(participantRecords);
        setAvailableMembers(
          excludeRegisteredMembers(memberRecords, participantRecords),
        );
        setRankSettings(settings ?? DEFAULT_RANK_SETTINGS);
      })
      .catch(() => {
        if (!cancelled) {
          setError("참석자 정보를 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const filteredMembers = useMemo(() => {
    const normalizedKeyword = searchKeyword.trim().toLowerCase();

    if (!normalizedKeyword) {
      return availableMembers;
    }

    return availableMembers.filter((member) => {
      return (
        member.name.toLowerCase().includes(normalizedKeyword) ||
        member.nickname.toLowerCase().includes(normalizedKeyword)
      );
    });
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

  const refreshParticipants = async () => {
    setIsLoading(true);
    setError("");

    try {
      const [participantRecords, memberRecords, settings] = await Promise.all([
        getEventParticipants(eventId),
        getMembers(),
        getRankSettings(),
      ]);

      setParticipants(participantRecords);
      setAvailableMembers(
        excludeRegisteredMembers(memberRecords, participantRecords),
      );
      setRankSettings(settings ?? DEFAULT_RANK_SETTINGS);
      setSelectedMemberIds(new Set());
    } catch {
      setError("참석자 정보를 다시 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

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
      if (caughtError instanceof Error) {
        setError(caughtError.message);
      } else {
        setError("참석자를 추가하지 못했습니다.");
      }
    } finally {
      setIsWorking(false);
    }
  };

  const handleStatusChange = async (
    participant: EventParticipantWithMember,
    status: GameParticipationStatus,
  ) => {
    setIsWorking(true);
    setError("");

    try {
      const updatedParticipant = await updateGameParticipationStatus(
        participant.id,
        status,
        participant.version,
      );

      setParticipants((currentParticipants) =>
        currentParticipants.map((currentParticipant) => {
          if (currentParticipant.id !== updatedParticipant.id) {
            return currentParticipant;
          }

          return {
            ...currentParticipant,
            ...updatedParticipant,
            expand: currentParticipant.expand,
          };
        }),
      );
    } catch (caughtError) {
      if (caughtError instanceof Error) {
        setError(caughtError.message);
      } else {
        setError("게임 참가 상태를 변경하지 못했습니다.");
      }
    } finally {
      setIsWorking(false);
    }
  };

  const handleRemoveParticipant = async (
    participant: EventParticipantWithMember,
  ) => {
    const shouldRemove = window.confirm(
      `${participant.display_name}님을 참석자 명단에서 제거할까요?`,
    );

    if (!shouldRemove) {
      return;
    }

    setIsWorking(true);
    setError("");

    try {
      await removeEventParticipant(participant.id);

      setParticipants((currentParticipants) =>
        currentParticipants.filter(
          (currentParticipant) => currentParticipant.id !== participant.id,
        ),
      );

      if (
        participant.participant_type === "member" &&
        participant.expand?.member
      ) {
        setAvailableMembers((currentMembers) => [
          ...currentMembers,
          participant.expand!.member!,
        ]);
      }
    } catch {
      setError("참석자를 제거하지 못했습니다.");
    } finally {
      setIsWorking(false);
    }
  };

  const handleGuestCreated = () => {
    void refreshParticipants();
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
            onClick={refreshParticipants}
            disabled={isLoading || isWorking}
          >
            <RefreshCw size={17} aria-hidden="true" />
            다시 시도
          </button>
        </div>
      )}

      <div className={styles.participantLayout}>
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
              <p className={styles.panelEmpty}>
                회원 목록을 불러오는 중입니다…
              </p>
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
                    onChange={() => {
                      toggleMemberSelection(member.id);
                    }}
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
              onClick={handleAddSelectedMembers}
              disabled={isWorking || selectedMemberIds.size === 0}
            >
              <UserPlus size={18} aria-hidden="true" />
              선택한 회원 {selectedMemberIds.size}명 추가
            </button>

            <button
              type="button"
              className={styles.cancelButton}
              onClick={() => {
                setGuestModalOpen(true);
              }}
              disabled={isWorking}
            >
              게스트 추가
            </button>
          </div>
        </section>

        <section className={styles.participantPanel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>현재 참석자</h2>
              <p>팀 편성에는 게임 참가 상태인 사람만 포함됩니다.</p>
            </div>

            <Users size={22} aria-hidden="true" />
          </div>

          <div className={styles.participantList}>
            {isLoading ? (
              <p className={styles.panelEmpty}>
                참석자 목록을 불러오는 중입니다…
              </p>
            ) : participants.length === 0 ? (
              <p className={styles.panelEmpty}>
                아직 등록된 참석자가 없습니다.
              </p>
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
                    <label
                      htmlFor={`participant-status-${participant.id}`}
                      className={styles.visuallyHidden}
                    >
                      {participant.display_name} 게임 참가 상태
                    </label>

                    <select
                      id={`participant-status-${participant.id}`}
                      className={styles.statusSelect}
                      value={participant.game_participation_status}
                      disabled={isWorking}
                      aria-label={`${participant.display_name} 게임 참가 상태`}
                      onChange={(changeEvent) => {
                        void handleStatusChange(
                          participant,
                          changeEvent.target.value as GameParticipationStatus,
                        );
                      }}
                    >
                      {Object.entries(GAME_PARTICIPATION_STATUS_LABELS).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>

                    <button
                      type="button"
                      className={styles.removeButton}
                      onClick={() => {
                        void handleRemoveParticipant(participant);
                      }}
                      disabled={isWorking}
                      aria-label={`${participant.display_name} 참석자 제거`}
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

      {isGuestModalOpen && (
        <GuestFormModal
          eventId={eventId}
          rankSettings={rankSettings}
          onClose={() => {
            setGuestModalOpen(false);
          }}
          onCreated={handleGuestCreated}
        />
      )}
    </section>
  );
}
