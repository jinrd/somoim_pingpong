import { useMemo, useState } from "react";

import type { EventGameSetting } from "../game-settings/types";

import MatchMonitorSummary from "./MatchMonitorSummary";
import useMatchMonitorData from "./useMatchMonitorData";
import MatchMonitorList from "./MatchMonitorList";
import MatchResultConfirmDialog from "./MatchResultConfirmDialog";
import MatchResultCancelDialog from "./MatchResultCancelDialog";
import useMatchMonitorActions from "./useMatchMonitorActions";
import MatchMonitorHeader from "./MatchMonitorHeader";
import MatchMonitorFeedback from "./MatchMonitorFeedback";
import MatchMonitorStatusPanel from "./MatchMonitorStatusPanel";

import type { MonitorFilter } from "./types";

import styles from "./MatchMonitorPanel.module.css";

interface Props {
  setting: EventGameSetting | null;
  onEventStatusChanged?: () => void | Promise<void>;
}

export default function MatchMonitorPanel({
  setting,
  onEventStatusChanged,
}: Props) {
  const { matches, isLoading, error, setError, loadMatches } =
    useMatchMonitorData({
      setting,
    });
  const [activeFilter, setActiveFilter] = useState<MonitorFilter>("all");

  const {
    workingMatchId,
    message,
    resultTarget,
    homeScore,
    awayScore,
    resultReason,
    homeParticipantIds,
    awayParticipantIds,
    cancelTarget,
    cancelReason,
    setHomeScore,
    setAwayScore,
    setResultReason,
    setHomeParticipantIds,
    setAwayParticipantIds,
    setCancelReason,
    openResult,
    closeResult,
    openCancel,
    closeCancel,
    confirmResult,
    cancelResult,
  } = useMatchMonitorActions({
    setting,
    setError,
    loadMatches,
    onEventStatusChanged,
  });

  const visibleMatches = useMemo(() => {
    if (activeFilter === "all") {
      return matches;
    }

    if (activeFilter === "waiting") {
      return matches.filter(
        (match) => match.status === "scheduled" || match.status === "ready",
      );
    }

    return matches.filter((match) => match.status === activeFilter);
  }, [activeFilter, matches]);

  if (!setting) {
    return (
      <MatchMonitorStatusPanel message="게임 설정을 먼저 저장해 주세요." />
    );
  }

  return (
    <section className={styles.panel}>
      <MatchMonitorHeader
        isLoading={isLoading}
        onRefresh={() => {
          void loadMatches(true);
        }}
      />

      <MatchMonitorSummary
        matches={matches}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      <MatchMonitorFeedback error={error} message={message} />

      <MatchMonitorList
        matches={matches}
        visibleMatches={visibleMatches}
        isLoading={isLoading}
        isWorking={Boolean(workingMatchId)}
        onOpenResult={openResult}
        onCancelResult={openCancel}
      />

      <MatchResultConfirmDialog
        target={resultTarget}
        homeScore={homeScore}
        awayScore={awayScore}
        reason={resultReason}
        homeParticipantIds={homeParticipantIds}
        awayParticipantIds={awayParticipantIds}
        error={error}
        isWorking={Boolean(workingMatchId)}
        onHomeScoreChange={(score) => {
          setHomeScore(score);
          setError("");
        }}
        onAwayScoreChange={(score) => {
          setAwayScore(score);
          setError("");
        }}
        onReasonChange={(reason) => {
          setResultReason(reason);
          setError("");
        }}
        onHomeParticipantIdsChange={(ids) => {
          setHomeParticipantIds(ids);
          setError("");
        }}
        onAwayParticipantIdsChange={(ids) => {
          setAwayParticipantIds(ids);
          setError("");
        }}
        onClose={closeResult}
        onConfirm={() => {
          void confirmResult();
        }}
      />
      <MatchResultCancelDialog
        target={cancelTarget}
        reason={cancelReason}
        isWorking={Boolean(workingMatchId)}
        onReasonChange={setCancelReason}
        onClose={closeCancel}
        onConfirm={() => {
          void cancelResult();
        }}
      />
    </section>
  );
}
