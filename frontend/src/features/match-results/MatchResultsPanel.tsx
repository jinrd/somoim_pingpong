import type { MatchResultsPanelProps } from "./types";
import IndividualResults from "./IndividualResults";
import MatchResultsHeader from "./MatchResultsHeader";
import TeamResults from "./TeamResults";
import useMatchResultsData from "./useMatchResultsData";

import styles from "./MatchResultsPanel.module.css";

export default function MatchResultsPanel({ setting }: MatchResultsPanelProps) {
  const { context, error } = useMatchResultsData(setting);

  if (!setting) {
    return null;
  }

  return (
    <section className={styles.panel}>
      <MatchResultsHeader />

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {!context ? (
        <p className={styles.empty}>결과 정보를 불러오는 중입니다…</p>
      ) : context.competitionType === "team_league" ? (
        <TeamResults schedule={context.schedule} />
      ) : (
        <IndividualResults schedule={context.schedule} />
      )}
    </section>
  );
}
