import type { MonitorFilter, MonitorMatch } from "./types";

import styles from "./MatchMonitorPanel.module.css";

interface Props {
  matches: MonitorMatch[];
  activeFilter: MonitorFilter;
  onFilterChange: (filter: MonitorFilter) => void;
}

const FILTERS: Array<{
  value: MonitorFilter;
  label: string;
}> = [
  { value: "all", label: "전체" },
  { value: "waiting", label: "대기" },
  { value: "in_progress", label: "진행 중" },
  { value: "completed", label: "완료" },
];

export default function MatchMonitorSummary({
  matches,
  activeFilter,
  onFilterChange,
}: Props) {
  const counts: Record<MonitorFilter, number> = {
    all: matches.length,
    waiting: matches.filter(
      (match) => match.status === "scheduled" || match.status === "ready",
    ).length,
    in_progress: matches.filter((match) => match.status === "in_progress")
      .length,
    completed: matches.filter((match) => match.status === "completed").length,
  };

  return (
    <div className={styles.summary}>
      {FILTERS.map((filter) => (
        <button
          key={filter.value}
          type="button"
          className={`${styles.summaryItem} ${
            activeFilter === filter.value ? styles.summaryItemActive : ""
          }`}
          aria-pressed={activeFilter === filter.value}
          onClick={() => onFilterChange(filter.value)}
        >
          <span>{filter.label}</span>
          <strong>{counts[filter.value]}</strong>
        </button>
      ))}
    </div>
  );
}
