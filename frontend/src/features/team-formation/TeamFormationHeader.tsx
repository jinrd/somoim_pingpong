import styles from "./TeamFormationPanel.module.css";

export default function TeamFormationHeader() {
  return (
    <header className={styles.panelHeader}>
      <div>
        <h2>팀 편성</h2>

        <p>팀을 선택하여 조정할 수 있습니다.</p>
      </div>
    </header>
  );
}
