import { AlertTriangle, CheckCircle2, Clock3 } from "lucide-react";

import type { MatchResultStatus } from "../match-schedule/api";

import styles from "./MatchResultsPanel.module.css";

interface Props {
  status: MatchResultStatus;
  submissionCount: number;
}

const getResultLabel = (
  status: MatchResultStatus,
  submissionCount: number,
): string => {
  if (status === "confirmed") {
    return "결과 확정";
  }

  if (status === "disputed") {
    return "입력 불일치";
  }

  if (submissionCount === 1) {
    return "상대 입력 대기";
  }

  return "결과 미입력";
};

export default function MatchResultStatus({ status, submissionCount }: Props) {
  const className =
    status === "confirmed"
      ? styles.confirmed
      : status === "disputed"
        ? styles.disputed
        : submissionCount === 1
          ? styles.waiting
          : styles.pending;

  return (
    <span className={className}>
      {status === "confirmed" ? (
        <CheckCircle2 size={14} aria-hidden="true" />
      ) : status === "disputed" ? (
        <AlertTriangle size={14} aria-hidden="true" />
      ) : (
        <Clock3 size={14} aria-hidden="true" />
      )}

      {getResultLabel(status, submissionCount)}
    </span>
  );
}
