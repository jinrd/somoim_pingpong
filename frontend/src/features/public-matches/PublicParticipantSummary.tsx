import PublicTeamSummary from "./PublicTeamSummary";
import { UserRound } from "lucide-react";

import {
  GAME_PARTICIPATION_STATUS_LABELS,
  type PublicIdentifiedParticipant,
} from "../events/types";

import styles from "./PublicMatchesSection.module.css";

interface Props {
  participant: PublicIdentifiedParticipant;
  competitionType: string;
}

export default function PublicParticipantSummary({
  participant,
  competitionType,
}: Props) {
  return (
    <>
      <section className={styles.participantSummary}>
        <div className={styles.participantSummaryIcon}>
          <UserRound size={20} aria-hidden="true" />
        </div>

        <div>
          <strong>{participant.displayName}님</strong>
          <span>{participant.rank}부</span>
        </div>

        <div className={styles.participantStatuses}>
          <span>
            참가 여부:{" "}
            {GAME_PARTICIPATION_STATUS_LABELS[
              participant.gameParticipationStatus
            ]}
          </span>
        </div>
      </section>

      {competitionType === "team_league" &&
        participant.gameParticipationStatus === "playing" && (
        participant.team ? (
          <PublicTeamSummary
            team={{
              id: participant.team.id,
              name: participant.team.name,
              sortOrder: participant.team.sortOrder,
            }}
            members={participant.team.members}
          />
        ) : (
          <section className={styles.teamPendingNotice}>
            <strong>팀 편성 대기 중</strong>
            <p>운영진이 팀을 편성하면 팀 정보가 표시됩니다.</p>
          </section>
        )
      )}
    </>
  );
}
