import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import type { TeamDraft, TeamMemberDraft } from "./types";

import styles from "./TeamFormationPanel.module.css";

interface Props {
  member: TeamMemberDraft;
  teamKey: string;
  teams: TeamDraft[];
  disabled: boolean;
  onMove: (participantId: string, targetTeamKey: string) => void;
}

export default function TeamMemberCard({
  member,
  teamKey,
  teams,
  disabled,
  onMove,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `member:${member.participantId}`,
      data: {
        teamKey,
      },
      disabled,
    });

  return (
    <div
      ref={setNodeRef}
      className={isDragging ? styles.memberCardDragging : styles.memberCard}
      style={{
        transform: CSS.Translate.toString(transform),
      }}
    >
      <button
        type="button"
        className={styles.memberDragHandle}
        disabled={disabled}
        aria-label={`${member.displayName} 팀 이동`}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={17} aria-hidden="true" />
      </button>

      <div className={styles.memberInfo}>
        <strong>{member.displayName}</strong>

        <span>
          {member.rankSnapshot}부 ·{" "}
          {member.participantType === "guest" ? "게스트" : "회원"}
        </span>
      </div>

      <label className={styles.mobileTeamMove}>
        <span className={styles.visuallyHidden}>
          {member.displayName} 이동할 팀
        </span>

        <select
          value={teamKey}
          disabled={disabled}
          aria-label={`${member.displayName} 이동할 팀`}
          onChange={(event) => onMove(member.participantId, event.target.value)}
        >
          {teams.map((team) => (
            <option key={team.key} value={team.key}>
              {team.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
