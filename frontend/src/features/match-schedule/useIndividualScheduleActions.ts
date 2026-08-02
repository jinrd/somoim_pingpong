import { useState } from "react";

import type { EventGameSetting } from "../game-settings/types";

import {
  deleteSchedule,
  saveIndividualSchedule,
  startIndividualLeague,
  type IndividualScheduleContext,
} from "./api";
import {
  generateRoundRobin,
  type RoundRobinSchedule,
} from "./generateRoundRobin";
import {
  getIndividualMatchOrderSignature,
  shuffleParticipants,
} from "./individualScheduleUtils";
import { getScheduleErrorMessage } from "./scheduleErrorUtils";
interface Options {
  setting: EventGameSetting | null;
  context: IndividualScheduleContext | null;
  preview: RoundRobinSchedule | null;
  setPreview: (preview: RoundRobinSchedule | null) => void;
  setError: (error: string) => void;
  setMessage: (message: string) => void;
  loadSchedule: () => Promise<void>;
  onScheduleChanged?: (hasSchedule: boolean) => void;
}

export default function useIndividualScheduleActions({
  setting,
  context,
  preview,
  setPreview,
  setError,
  setMessage,
  loadSchedule,
  onScheduleChanged,
}: Options) {
  const [isSaving, setIsSaving] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const handleGeneratePreview = () => {
    if (!context) {
      return;
    }

    try {
      if (context.participants.length < 2) {
        setError("게임 참가 인원이 최소 2명 필요합니다.");
        return;
      }

      const currentSignature = preview
        ? getIndividualMatchOrderSignature(preview.matches)
        : getIndividualMatchOrderSignature(
            context.rounds.flatMap((round) => round.matches),
          );

      let nextSchedule: RoundRobinSchedule | null = null;

      for (let attempt = 0; attempt < 20; attempt += 1) {
        const candidate = generateRoundRobin(
          shuffleParticipants(context.participants),
        );

        if (
          getIndividualMatchOrderSignature(candidate.matches) !==
          currentSignature
        ) {
          nextSchedule = candidate;
          break;
        }
      }

      if (!nextSchedule) {
        setError("다른 경기 순서를 만들지 못했습니다. 다시 시도해 주세요.");
        return;
      }

      setPreview(nextSchedule);
      setError("");
      setMessage("대진 미리보기를 생성했습니다. 저장 전 내용을 확인해 주세요.");
    } catch (caughtError) {
      setError(
        getScheduleErrorMessage(caughtError, "대진을 생성하지 못했습니다."),
      );
    }
  };

  const handleSave = async () => {
    if (!setting || !context || !preview) {
      return;
    }

    if (
      context.totalMatchCount > 0 &&
      !window.confirm("기존 대진을 삭제하고 다시 생성할까요?")
    ) {
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const result = await saveIndividualSchedule(setting.id, {
        expectedScheduleVersion: context.scheduleVersion,
        schedule: preview,
      });

      onScheduleChanged?.(result.totalMatchCount > 0);
      await loadSchedule();

      setMessage(
        `${result.totalRoundCount}라운드, ${result.totalMatchCount}경기를 저장했습니다.`,
      );
    } catch (caughtError) {
      setError(
        getScheduleErrorMessage(caughtError, "대진을 저장하지 못했습니다."),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSchedule = async () => {
    if (!setting || !context) {
      return;
    }

    if (!window.confirm("저장된 개인 단식 대진표를 모두 삭제할까요?")) {
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      await deleteSchedule(setting.id);

      onScheduleChanged?.(false);
      window.dispatchEvent(new Event("scheduleDeleted"));

      await loadSchedule();
      setMessage("대진표가 완전히 삭제되었습니다.");
    } catch (caughtError) {
      setError(
        getScheduleErrorMessage(caughtError, "대진을 삭제하지 못했습니다."),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartLeague = async () => {
    if (!setting || !context || context.totalMatchCount === 0) {
      return;
    }

    const isRecoveringAssignment = context.operationStatus === "in_progress";

    if (
      !isRecoveringAssignment &&
      !window.confirm(
        `개인 단식 리그를 시작할까요?\n\n` +
          `${context.tableCount}개 테이블에 출전자가 겹치지 않는 경기부터 자동 배정됩니다.\n` +
          "시작 후에는 대진표를 다시 만들거나 삭제할 수 없습니다.",
      )
    ) {
      return;
    }

    setIsStarting(true);
    setError("");
    setMessage("");

    try {
      const result = await startIndividualLeague(setting.id);

      await loadSchedule();

      setMessage(
        isRecoveringAssignment
          ? `${result.assignedMatches.length}경기를 빈 테이블에 다시 배정했습니다.`
          : `단식 리그를 시작했습니다. ${result.assignedMatches.length}경기를 테이블에 배정했습니다.`,
      );
    } catch (caughtError) {
      setError(
        getScheduleErrorMessage(
          caughtError,
          "단식 리그를 시작하지 못했습니다.",
        ),
      );
    } finally {
      setIsStarting(false);
    }
  };

  return {
    isSaving,
    isStarting,
    handleGeneratePreview,
    handleSave,
    handleDeleteSchedule,
    handleStartLeague,
  };
}
