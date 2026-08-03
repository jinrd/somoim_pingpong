import { useState } from "react";

import type { EventGameSetting } from "../game-settings/types";

import StandingsMatchDetail from "./StandingsMatchDetail";
import StandingsMatrix from "./StandingsMatrix";
import StandingsRanking from "./StandingsRanking";
import { orientMatchForEntity } from "./standingsUtils";
import useStandingsData from "./useStandingsData";
import StandingsViewTabs, { type StandingsView } from "./StandingsViewTabs";
import StandingsHeader from "./StandingsHeader";
import styles from "./LeagueStandingsPanel.module.css";

interface LeagueStandingsPanelProps {
  setting?: EventGameSetting | null;
  responseToken?: string;
}
interface SelectedMatchTarget {
  id: string;
  homeEntityId: string;
}

export default function LeagueStandingsPanel({
  setting,
  responseToken,
}: LeagueStandingsPanelProps) {
  const [selectedMatchTarget, setSelectedMatchTarget] =
    useState<SelectedMatchTarget | null>(null);
  const [activeView, setActiveView] = useState<StandingsView>("ranking");
  const { response, error } = useStandingsData({
    settingId: setting?.id,
    responseToken,
  });

  if (!setting && !responseToken) {
    return null;
  }

  if (!response && !error) {
    return (
      <section className={styles.panel}>순위 정보를 불러오는 중입니다…</section>
    );
  }
  const selectedMatch =
    selectedMatchTarget && response
      ? (() => {
          const match = response.matches.find(
            (item) => item.id === selectedMatchTarget.id,
          );

          return match
            ? orientMatchForEntity(match, selectedMatchTarget.homeEntityId)
            : null;
        })()
      : null;
  return (
    <section className={styles.panel}>
      <StandingsHeader />

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {response &&
        (response.entities.length === 0 ? (
          <p className={styles.empty}>표시할 리그 대진이 없습니다.</p>
        ) : (
          <>
            <StandingsViewTabs
              activeView={activeView}
              onChange={setActiveView}
            />

            <section
              id="standings-ranking-panel"
              role="tabpanel"
              aria-labelledby="standings-ranking-tab"
              className={`${styles.rankingSection} ${
                activeView !== "ranking" ? styles.viewHidden : ""
              }`}
            >
              <StandingsRanking standings={response.standings} />
            </section>

            <div
              id="standings-matrix-panel"
              role="tabpanel"
              aria-labelledby="standings-matrix-tab"
              className={`${styles.matrixScroll} ${
                activeView !== "matrix" ? styles.viewHidden : ""
              }`}
            >
              <StandingsMatrix
                response={response}
                onSelectMatch={(match) => {
                  setSelectedMatchTarget({
                    id: match.id,
                    homeEntityId: match.homeEntity.id,
                  });
                }}
              />
            </div>

            {selectedMatch && (
              <div
                className={styles.detailBackdrop}
                role="presentation"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) {
                    setSelectedMatchTarget(null);
                  }
                }}
              >
                <StandingsMatchDetail
                  match={selectedMatch}
                  competitionType={response.competitionType}
                  onClose={() => setSelectedMatchTarget(null)}
                />
              </div>
            )}
          </>
        ))}
    </section>
  );
}
