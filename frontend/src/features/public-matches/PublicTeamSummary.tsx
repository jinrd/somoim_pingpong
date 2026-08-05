import { Shield, UserRound } from "lucide-react";

import type { PublicTeam, PublicTeamMember } from "./types";

import styles from "./PublicMatchesSection.module.css";

interface Props {
  team: PublicTeam;
  members?: PublicTeamMember[];
}

export default function PublicTeamSummary({ team, members = [] }: Props) {
  return (
    <section className={styles.teamSummarySection}>
      <div className={styles.teamSummaryHeading}>
        <Shield size={20} aria-hidden="true" />

        <div>
          <span>내 팀</span>
          <strong>
            {team.sortOrder > 0
              ? `${team.sortOrder}번 팀 · ${team.name}`
              : team.name}
            <small>{members.length}명</small>
          </strong>
        </div>
      </div>

      {members.length === 0 ? (
        <p className={styles.empty}>아직 팀원 정보가 없습니다.</p>
      ) : (
        <div className={styles.teamMemberList}>
          {members.map((member) => (
            <div
              key={member.participantId}
              className={
                member.isRequester ? styles.teamMemberCurrent : styles.teamMember
              }
            >
              <UserRound size={17} aria-hidden="true" />

              <span>
                {member.displayName}
                {member.isRequester ? " (나)" : ""}
              </span>

              <small>
                {member.rankSnapshot > 0
                  ? `${member.rankSnapshot}부`
                  : "부수 미정"}
              </small>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
