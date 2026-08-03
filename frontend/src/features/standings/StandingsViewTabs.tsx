import styles from "./LeagueStandingsPanel.module.css";

export type StandingsView = "ranking" | "matrix";

interface Props {
  activeView: StandingsView;
  onChange: (view: StandingsView) => void;
}

export default function StandingsViewTabs({ activeView, onChange }: Props) {
  return (
    <div
      className={styles.standingsViewTabs}
      role="tablist"
      aria-label="순위표 보기"
    >
      <button
        id="standings-ranking-tab"
        type="button"
        role="tab"
        className={
          activeView === "ranking"
            ? styles.standingsViewTabActive
            : styles.standingsViewTab
        }
        aria-selected={activeView === "ranking"}
        aria-controls="standings-ranking-panel"
        tabIndex={activeView === "ranking" ? 0 : -1}
        onClick={() => onChange("ranking")}
      >
        순위
      </button>

      <button
        id="standings-matrix-tab"
        type="button"
        role="tab"
        className={
          activeView === "matrix"
            ? styles.standingsViewTabActive
            : styles.standingsViewTab
        }
        aria-selected={activeView === "matrix"}
        aria-controls="standings-matrix-panel"
        tabIndex={activeView === "matrix" ? 0 : -1}
        onClick={() => onChange("matrix")}
      >
        상대 전적
      </button>
    </div>
  );
}
