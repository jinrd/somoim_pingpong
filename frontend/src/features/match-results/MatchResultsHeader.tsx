import styles from "./MatchResultsPanel.module.css";

export default function MatchResultsHeader() {
  return (
    <header className={styles.header}>
      <div>
        <h2>전체 경기 결과</h2>
        <p>경기 결과는 화면이 열려 있을 때 자동으로 반영됩니다.</p>
      </div>
    </header>
  );
}
