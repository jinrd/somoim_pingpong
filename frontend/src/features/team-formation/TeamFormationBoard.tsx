import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Users } from "lucide-react";

import TeamColumn from "./TeamColumn";
import type { TeamDraft } from "./types";

import styles from "./TeamFormationPanel.module.css";

interface Props {
  teams: TeamDraft[];
  disabled: boolean;
  onMemberMove: (participantId: string, targetTeamKey: string) => void;
  onTeamNameChange: (teamKey: string, name: string) => void;
}

export default function TeamFormationBoard({
  teams,
  disabled,
  onMemberMove,
  onTeamNameChange,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const overId = event.over ? String(event.over.id) : "";

    if (!overId.startsWith("team:")) {
      return;
    }

    const participantId = String(event.active.id).replace(/^member:/, "");
    const targetTeamKey = overId.replace(/^team:/, "");

    onMemberMove(participantId, targetTeamKey);
  };

  if (teams.length === 0) {
    return (
      <div className={styles.emptyFormation}>
        <Users size={30} aria-hidden="true" />
        <strong>아직 편성된 팀이 없습니다.</strong>
        <span>자동 편성 버튼을 눌러 주세요.</span>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragEnd={handleDragEnd}
    >
      <div className={styles.teamGrid}>
        {teams.map((team) => (
          <TeamColumn
            key={team.key}
            team={team}
            teams={teams}
            disabled={disabled}
            onMemberMove={onMemberMove}
            onNameChange={(name) => onTeamNameChange(team.key, name)}
          />
        ))}
      </div>
    </DndContext>
  );
}
