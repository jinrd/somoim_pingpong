import { Loader2 } from "lucide-react";

import MatchMonitorCard from "./MatchMonitorCard";

import type { MonitorMatch, MonitorResult } from "./types";

import styles from "./MatchMonitorPanel.module.css";

interface Props {
  matches: MonitorMatch[];
  visibleMatches: MonitorMatch[];
  isLoading: boolean;
  isWorking: boolean;
  onOpenResult: (result: MonitorResult) => void;
  onCancelResult: (result: MonitorResult) => void;
}

export default function MatchMonitorList({
  matches,
  visibleMatches,
  isLoading,
  isWorking,
  onOpenResult,
  onCancelResult,
}: Props) {
  if (isLoading && matches.length === 0) {
    return (
      <div className={styles.empty}>
        <Loader2 className={styles.spinner} size={24} aria-hidden="true" />
        경기 현황을 불러오는 중입니다…
      </div>
    );
  }

  if (matches.length === 0) {
    return <div className={styles.empty}>저장된 대진이 없습니다.</div>;
  }

  if (visibleMatches.length === 0) {
    return (
      <div className={styles.filteredEmpty}>선택한 상태의 경기가 없습니다.</div>
    );
  }

  const matchesByRound = visibleMatches.reduce<Map<number, MonitorMatch[]>>(
    (rounds, match) => {
      const roundMatches = rounds.get(match.round) || [];
      roundMatches.push(match);
      rounds.set(match.round, roundMatches);
      return rounds;
    },
    new Map(),
  );

  return (
    <div className={styles.matchRoundList}>
      {[...matchesByRound.entries()]
        .sort(([leftRound], [rightRound]) => leftRound - rightRound)
        .map(([round, roundMatches]) => (
          <section key={round} className={styles.matchRoundGroup}>
            <h3>{round}라운드</h3>

            <div className={styles.matchList}>
              {roundMatches.map((match) => (
                <MatchMonitorCard
                  key={match.id}
                  match={match}
                  isWorking={isWorking}
                  onOpenResult={onOpenResult}
                  onCancelResult={onCancelResult}
                />
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}
