import { Trash2, Users } from "lucide-react";

import {
  GAME_PARTICIPATION_STATUS_LABELS,
  type EventParticipantWithMember,
  type GameParticipationStatus,
} from "./types";
import { getParticipantTypeLabel, isInactiveMember } from "./participantUtils";

import styles from "./Events.module.css";

interface Props {
  participants: EventParticipantWithMember[];
  isLoading: boolean;
  isWorking: boolean;
  isParticipationClosed: boolean;
  hasStartedMatches: boolean;
  onStatusChange: (
    participant: EventParticipantWithMember,
    status: GameParticipationStatus,
  ) => void;
  onRemove: (participant: EventParticipantWithMember) => void;
}

export default function ParticipantList({
  participants,
  isLoading,
  isWorking,
  isParticipationClosed,
  hasStartedMatches,
  onStatusChange,
  onRemove,
}: Props) {
  return (
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
          <p className={styles.panelEmpty}>참석자 목록을 불러오는 중입니다…</p>
        ) : participants.length === 0 ? (
          <p className={styles.panelEmpty}>아직 등록된 참석자가 없습니다.</p>
        ) : (
          participants.map((participant) => (
            <article key={participant.id} className={styles.participantItem}>
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
                      participant.game_participation_status === "not_playing")
                  }
                  aria-label={`${participant.display_name} 게임 참가 상태`}
                  onChange={(event) =>
                    onStatusChange(
                      participant,
                      event.target.value as GameParticipationStatus,
                    )
                  }
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
                  disabled={
                    isWorking || hasStartedMatches || isParticipationClosed
                  }
                  aria-label={`${participant.display_name} 참석자 제거`}
                  title={
                    isParticipationClosed
                      ? "참가 신청 마감 후에는 참석자를 제거할 수 없습니다."
                      : undefined
                  }
                  onClick={() => onRemove(participant)}
                >
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
