import { AlertTriangle, CheckCircle2 } from "lucide-react";

import type { MatchResultStatus as ResultStatus } from "../match-schedule/api";

import styles from "./MatchResultsPanel.module.css";

interface Props {
  status: ResultStatus;
}

export default function MatchResultStatus({ status }: Props) {
  if (status === "pending") {
    return null;
  }

  const isMatched = status === "confirmed";

  return (
    <span className={isMatched ? styles.confirmed : styles.disputed}>
      {isMatched ? (
        <CheckCircle2 size={14} aria-hidden="true" />
      ) : (
        <AlertTriangle size={14} aria-hidden="true" />
      )}

      {isMatched ? "결과 일치" : "결과 불일치"}
    </span>
  );
}
