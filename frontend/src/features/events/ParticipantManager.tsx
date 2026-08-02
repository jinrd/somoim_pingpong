import { useMemo, useState } from "react";

import { ClientResponseError } from "pocketbase";
import ParticipantList from "./ParticipantList";
import ParticipantErrorPanel from "./ParticipantErrorPanel";
import {
  addMembersToEvent,
  closeEventParticipation,
  removeEventParticipant,
  updateGameParticipationStatus,
} from "./api";
import GuestFormModal from "./GuestFormModal";
import {
  type EventParticipantWithMember,
  type GameParticipationStatus,
  type SomoimEvent,
} from "./types";
import ParticipantSummary from "./ParticipantSummary";
import ParticipantMemberPicker from "./ParticipantMemberPicker";
import ParticipationStatusPanel from "./ParticipationStatusPanel";
import ParticipationCloseDialog from "./ParticipationCloseDialog";
import useParticipantData from "./useParticipantData";
import useParticipantMemberSelection from "./useParticipantMemberSelection";
import {
  getParticipantErrorMessage,
  isInactiveMember,
} from "./participantUtils";
import styles from "./Events.module.css";

interface Props {
  eventRecord: SomoimEvent;
  hasGameConfiguration: boolean;
  onEventUpdated: (eventRecord: SomoimEvent) => void;
  onGameConfigurationReset: () => void;
}

export default function ParticipantManager({
  eventRecord,
  hasGameConfiguration,
  onEventUpdated,
  onGameConfigurationReset,
}: Props) {
  const eventId = eventRecord.id;
  const isParticipationClosed = eventRecord.participation_status === "closed";

  const {
    participants,
    availableMembers,
    rankSettings,
    isLoading,
    hasStartedMatches,
    error,
    setParticipants,
    setError,
    refreshParticipants,
  } = useParticipantData(eventId);
  const {
    selectedMemberIds,
    searchKeyword,
    filteredMembers,
    setSearchKeyword,
    toggleMemberSelection,
    resetMemberSelection,
  } = useParticipantMemberSelection(availableMembers);
  const [isWorking, setIsWorking] = useState(false);
  const [isGuestModalOpen, setGuestModalOpen] = useState(false);
  const [isCloseConfirmationOpen, setCloseConfirmationOpen] = useState(false);

  const participantCounts = useMemo(
    () =>
      participants.reduce(
        (counts, participant) => {
          counts[participant.game_participation_status] += 1;
          return counts;
        },
        {
          playing: 0,
          not_playing: 0,
          undecided: 0,
        },
      ),
    [participants],
  );

  const playingCount = participantCounts.playing;
  const notPlayingCount = participantCounts.not_playing;
  const undecidedCount = participantCounts.undecided;

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
      resetMemberSelection();
    } catch (caughtError) {
      setError(
        getParticipantErrorMessage(
          caughtError,
          "참석자를 추가하지 못했습니다.",
        ),
      );
    } finally {
      setIsWorking(false);
    }
  };

  const handleCloseParticipation = async () => {
    if (undecidedCount > 0) {
      setError(
        `참가 상태가 미정인 참석자 ${undecidedCount}명이 있습니다. 모두 확정한 후 마감해 주세요.`,
      );
      setCloseConfirmationOpen(false);
      return;
    }

    setCloseConfirmationOpen(false);
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
        getParticipantErrorMessage(
          caughtError,
          "참가 신청을 마감하지 못했습니다.",
        ),
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
      setError(
        "이미 시작했거나 완료된 경기가 있어 참가 상태를 변경할 수 없습니다.",
      );
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
        getParticipantErrorMessage(
          caughtError,
          "게임 참가 상태를 변경하지 못했습니다.",
        ),
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
      resetMemberSelection();
    } catch (caughtError) {
      setError(
        getParticipantErrorMessage(
          caughtError,
          "참석자를 제거하지 못했습니다.",
        ),
      );
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <section className={styles.participantSection}>
      <ParticipantSummary
        totalCount={participants.length}
        playingCount={playingCount}
        notPlayingCount={notPlayingCount}
        undecidedCount={undecidedCount}
      />

      <ParticipantErrorPanel
        message={error}
        isLoading={isLoading}
        isWorking={isWorking}
        onRetry={() => void refreshParticipants()}
      />

      <ParticipationStatusPanel
        isParticipationClosed={isParticipationClosed}
        hasStartedMatches={hasStartedMatches}
        undecidedCount={undecidedCount}
        isLoading={isLoading}
        isWorking={isWorking}
        onCloseRequest={() => {
          setError("");
          setCloseConfirmationOpen(true);
        }}
      />

      <div
        className={`${styles.participantLayout} ${
          isParticipationClosed ? styles.participantLayoutClosed : ""
        }`}
      >
        {!isParticipationClosed && (
          <ParticipantMemberPicker
            members={filteredMembers}
            selectedMemberIds={selectedMemberIds}
            searchKeyword={searchKeyword}
            isLoading={isLoading}
            isWorking={isWorking}
            onSearchChange={setSearchKeyword}
            onMemberToggle={toggleMemberSelection}
            onAddSelectedMembers={() => void handleAddSelectedMembers()}
            onGuestAdd={() => setGuestModalOpen(true)}
          />
        )}

        <ParticipantList
          participants={participants}
          isLoading={isLoading}
          isWorking={isWorking}
          isParticipationClosed={isParticipationClosed}
          hasStartedMatches={hasStartedMatches}
          onStatusChange={(participant, status) =>
            void handleStatusChange(participant, status)
          }
          onRemove={(participant) => void handleRemoveParticipant(participant)}
        />
      </div>

      {isGuestModalOpen && !isParticipationClosed && (
        <GuestFormModal
          eventId={eventId}
          rankSettings={rankSettings}
          onClose={() => setGuestModalOpen(false)}
          onCreated={() => {
            resetMemberSelection();
            void refreshParticipants();
          }}
        />
      )}
      <ParticipationCloseDialog
        isOpen={isCloseConfirmationOpen}
        isWorking={isWorking}
        onCancel={() => setCloseConfirmationOpen(false)}
        onConfirm={() => void handleCloseParticipation()}
      />
    </section>
  );
}
