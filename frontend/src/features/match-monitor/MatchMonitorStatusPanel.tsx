import styles from "./MatchMonitorPanel.module.css";

interface Props {
  message: string;
}

export default function MatchMonitorStatusPanel({ message }: Props) {
  return (
    <section className={styles.panel}>
      <h2>경기 진행</h2>
      <p>{message}</p>
    </section>
  );
}
