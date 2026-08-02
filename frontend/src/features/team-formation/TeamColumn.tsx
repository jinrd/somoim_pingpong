import { useDroppable } from "@dnd-kit/core";

import TeamMemberCard from "./TeamMemberCard";
import type { TeamDraft } from "./types";

import styles from "./TeamFormationPanel.module.css";

interface Props {
  team: TeamDraft;
  teams: TeamDraft[];
  disabled: boolean;
  onNameChange: (name: string) => void;
  onMemberMove: (participantId: string, targetTeamKey: string) => void;
}

const calculateAverageRank = (team: TeamDraft): number => {
  if (team.members.length === 0) {
    return 0;
  }

  const totalRank = team.members.reduce(
    (sum, member) => sum + member.rankSnapshot,
    0,
  );

  return Math.round((totalRank / team.members.length) * 100) / 100;
};

export default function TeamColumn({
  team,
  teams,
  disabled,
  onNameChange,
  onMemberMove,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: `team:${team.key}`,
    disabled,
  });

  const averageRank = calculateAverageRank(team);

  return (
    <article
      ref={setNodeRef}
      className={isOver ? styles.teamColumnOver : styles.teamColumn}
    >
      <header className={styles.teamHeader}>
        <input
          value={team.name}
          maxLength={30}
          disabled={disabled}
          aria-label={`${team.name} 팀 이름 `}
          onChange={(event) => onNameChange(event.target.value)}
        />

        <div className={styles.teamStats}>
          <span>
            ({team.members.length}명, 평균 {averageRank || "-"}부)
          </span>
        </div>
      </header>

      <div className={styles.memberList}>
        {team.members.length === 0 ? (
          <p className={styles.emptyTeam}>이곳에 팀원을 놓으세요.</p>
        ) : (
          team.members.map((member) => (
            <TeamMemberCard
              key={member.key}
              member={member}
              teamKey={team.key}
              teams={teams}
              disabled={disabled}
              onMove={onMemberMove}
            />
          ))
        )}
      </div>
    </article>
  );
}
