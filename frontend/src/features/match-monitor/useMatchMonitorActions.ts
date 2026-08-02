import { useState } from "react";

import type { EventGameSetting } from "../game-settings/types";

import {
  cancelIndividualMatchResult,
  cancelTeamGameResult,
  confirmIndividualMatchResult,
  confirmTeamGameResult,
} from "../match-schedule/api";
import { getScheduleErrorMessage } from "../match-schedule/scheduleErrorUtils";

import type { CancelTarget, MonitorResult } from "./types";

interface Options {
  setting: EventGameSetting | null;
  setError: (error: string) => void;
  loadMatches: (showLoading: boolean) => Promise<void>;
  onEventStatusChanged?: () => void | Promise<void>;
}

const getRequiredWins = (bestOf: number): number => Math.floor(bestOf / 2) + 1;

export default function useMatchMonitorActions({
  setting,
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

  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);
  const [cancelReason, setCancelReason] = useState("");

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
    setHomeScore(0);
    setAwayScore(0);
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

  const openCancel = (target: MonitorResult) => {
    setError("");
    setCancelReason("");
    setCancelTarget({
      id: target.id,
      type: target.type,
      title: target.title,
      version: target.version,
    });
  };

  const closeCancel = () => {
    if (workingMatchId) {
      return;
    }

    setCancelTarget(null);
    setCancelReason("");
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
        `${resultTarget.bestOf}판 경기의 승자는 ${requiredWins}승이어야 합니다.`,
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

      setMessage(`${resultTarget.title} 결과를 확정했습니다.`);
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

  const cancelResult = async () => {
    if (!setting || !cancelTarget) {
      return;
    }

    const reason = cancelReason.trim();

    setWorkingMatchId(cancelTarget.id);
    setError("");
    setMessage("");

    try {
      const input = {
        expectedVersion: cancelTarget.version,
        reason,
      };

      if (cancelTarget.type === "team_game") {
        await cancelTeamGameResult(cancelTarget.id, input);
      } else {
        await cancelIndividualMatchResult(cancelTarget.id, input);
      }

      setMessage(
        `${cancelTarget.title} 결과를 취소했습니다. 참가자가 결과를 다시 입력할 수 있습니다.`,
      );
      setCancelTarget(null);
      setCancelReason("");

      await loadMatches(false);
      await refreshEventStatus();
    } catch (caughtError) {
      setError(
        getScheduleErrorMessage(
          caughtError,
          "경기 결과를 취소하지 못했습니다.",
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
  };
}
