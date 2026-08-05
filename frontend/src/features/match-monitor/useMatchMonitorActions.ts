import { useState } from "react";

import {
  confirmIndividualMatchResult,
  confirmTeamGameResult,
} from "../match-schedule/api";
import { getScheduleErrorMessage } from "../match-schedule/scheduleErrorUtils";

import type { MonitorResult } from "./types";

import {
  getBestOfLabel,
  getRequiredWins,
} from "../match-schedule/matchFormatUtils";

interface Options {
  setError: (error: string) => void;
  loadMatches: (showLoading: boolean) => Promise<void>;
  onEventStatusChanged?: () => void | Promise<void>;
}


export default function useMatchMonitorActions({
  setError,
  loadMatches,
  onEventStatusChanged,
}: Options) {
  const [workingMatchId, setWorkingMatchId] = useState("");
  const [message, setMessage] = useState("");

  const [resultTarget, setResultTarget] = useState<MonitorResult | null>(null);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [resultReason, setResultReason] = useState("");
  const [homeParticipantIds, setHomeParticipantIds] = useState<string[]>([]);
  const [awayParticipantIds, setAwayParticipantIds] = useState<string[]>([]);



  const refreshEventStatus = async () => {
    try {
      await onEventStatusChanged?.();
    } catch {
      // 주기적 갱신에서 다시 불러옵니다.
    }
  };

  const openResult = (target: MonitorResult) => {
    setError("");
    setResultReason("");
    setHomeScore(target.homeScore);
    setAwayScore(target.awayScore);
    setHomeParticipantIds(target.homePlayerIds);
    setAwayParticipantIds(target.awayPlayerIds);
    setResultTarget(target);
  };

  const closeResult = () => {
    if (workingMatchId) {
      return;
    }

    setResultTarget(null);
    setResultReason("");
  };



  const confirmResult = async () => {
    if (!resultTarget) {
      return;
    }

    const reason = resultReason.trim();
    const requiredWins = getRequiredWins(resultTarget.bestOf);

    const isValidScore =
      (homeScore === requiredWins && awayScore < requiredWins) ||
      (awayScore === requiredWins && homeScore < requiredWins);

    if (!isValidScore) {
      setError(
        `${getBestOfLabel(resultTarget.bestOf)}에서는 승자가 ${requiredWins}승이어야 합니다.`,
      );
      return;
    }

    if (
      resultTarget.type === "team_game" &&
      (homeParticipantIds.length !== resultTarget.requiredPlayerCount ||
        awayParticipantIds.length !== resultTarget.requiredPlayerCount)
    ) {
      setError(
        `양 팀에서 실제 출전 선수 ${resultTarget.requiredPlayerCount}명씩 선택해 주세요.`,
      );
      return;
    }

    setWorkingMatchId(resultTarget.id);
    setError("");
    setMessage("");

    try {
      const input = {
        expectedVersion: resultTarget.version,
        homeScore,
        awayScore,
        reason,
        homeParticipantIds,
        awayParticipantIds,
      };

      if (resultTarget.type === "team_game") {
        await confirmTeamGameResult(resultTarget.id, input);
      } else {
        await confirmIndividualMatchResult(resultTarget.id, input);
      }

      setMessage(
        resultTarget.resultStatus === "confirmed"
          ? `${resultTarget.title} 결과를 수정했습니다.`
          : `${resultTarget.title} 결과를 확정했습니다.`,
      );
      setResultTarget(null);
      setResultReason("");

      await loadMatches(false);
      await refreshEventStatus();
    } catch (caughtError) {
      setError(
        getScheduleErrorMessage(
          caughtError,
          "경기 결과를 확정하지 못했습니다.",
        ),
      );
      await loadMatches(false);
    } finally {
      setWorkingMatchId("");
    }
  };



  return {
    workingMatchId,
    message,
    resultTarget,
    homeScore,
    awayScore,
    resultReason,
    homeParticipantIds,
    awayParticipantIds,
    setHomeScore,
    setAwayScore,
    setResultReason,
    setHomeParticipantIds,
    setAwayParticipantIds,
    openResult,
    closeResult,
    confirmResult,
  };
}
