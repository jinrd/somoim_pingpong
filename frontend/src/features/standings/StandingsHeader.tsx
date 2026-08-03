import styles from "./LeagueStandingsPanel.module.css";

export default function StandingsHeader() {
  return (
    <header className={styles.header}>
      <div>
        <h2>순위표</h2>

        <p className={styles.updateStatus}>
          <span aria-hidden="true" />
          자동 업데이트
        </p>
      </div>
    </header>
  );
}
