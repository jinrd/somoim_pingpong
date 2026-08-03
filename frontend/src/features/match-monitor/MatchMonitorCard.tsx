import { ClipboardCheck, RotateCcw } from "lucide-react";

import type { TeamMatchStatus } from "../match-schedule/api";
import type { MonitorMatch, MonitorResult } from "./types";

import styles from "./MatchMonitorPanel.module.css";

interface Props {
  match: MonitorMatch;
  isWorking: boolean;
  onOpenResult: (result: MonitorResult) => void;
  onCancelResult: (result: MonitorResult) => void;
}

const STATUS_LABELS: Record<TeamMatchStatus, string> = {
  scheduled: "대기 중",
  ready: "시작 가능",
  in_progress: "진행 중",
  completed: "완료",
  cancelled: "취소",
};

const getResultText = (result: MonitorResult): string => {
  if (result.resultStatus === "confirmed") {
    return `${result.homeName} ${result.homeScore} : ${result.awayScore} ${result.awayName} · 확정`;
  }

  if (result.resultStatus === "disputed") {
    return `${result.homeName} vs ${result.awayName} · 입력 불일치`;
  }

  if (result.submissionCount === 1) {
    return `${result.homeName} vs ${result.awayName} · 상대 입력 대기`;
  }

  return `${result.homeName} vs ${result.awayName} · 결과 미입력`;
};

const canAdminConfirm = (result: MonitorResult): boolean =>
  ["scheduled", "ready", "in_progress"].includes(result.status) &&
  result.resultStatus !== "confirmed";

export default function MatchMonitorCard({
  match,
  isWorking,
  onOpenResult,
  onCancelResult,
}: Props) {
  return (
    <article className={styles.matchCard}>
      <header className={styles.matchCardHeader}>
        <div className={styles.order}>
          <span>경기</span>
          <strong>{match.sortOrder}</strong>
        </div>

        <div className={styles.matchContent}>
          <strong>{match.title}</strong>
        </div>

        <span
          className={`${styles.status} ${
            match.hasDisputedResult
              ? styles.status_disputed
              : styles[`status_${match.status}`]
          }`}
        >
          {match.hasDisputedResult
            ? "결과 확인 필요"
            : STATUS_LABELS[match.status]}
        </span>
      </header>

      <div className={styles.matchDetails}>
        <span className={styles.matchDescription}>{match.description}</span>

        <div className={styles.resultLines}>
          {match.results.map((result) => (
            <div
              key={result.id}
              className={
                result.resultStatus === "disputed"
                  ? styles.resultDisputed
                  : styles.resultLine
              }
            >
              <div className={styles.resultContent}>
                <strong>{result.title}</strong>
                <span>{getResultText(result)}</span>
              </div>

              {canAdminConfirm(result) && (
                <button
                  type="button"
                  className={styles.inputResultButton}
                  disabled={isWorking}
                  onClick={() => onOpenResult(result)}
                >
                  <ClipboardCheck size={16} aria-hidden="true" />
                  {result.resultStatus === "disputed"
                    ? "점수 확인"
                    : "대신 입력"}
                </button>
              )}

              {result.resultStatus === "confirmed" && (
                <button
                  type="button"
                  className={styles.cancelResultButtonInline}
                  disabled={isWorking}
                  onClick={() => onCancelResult(result)}
                >
                  <RotateCcw size={15} aria-hidden="true" />
                  결과 취소
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

    </article>
  );
}
