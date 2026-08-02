import { useState } from "react";

import type { EventGameSetting } from "../game-settings/types";

import {
  deleteSchedule,
  saveTeamSchedule,
  type TeamScheduleContext,
} from "./api";
import {
  generateRoundRobin,
  type RoundRobinSchedule,
} from "./generateRoundRobin";
import {
  getMatchOrderSignature,
  shuffleTeamsForSchedule,
} from "./teamScheduleUtils";
import { getScheduleErrorMessage } from "./scheduleErrorUtils";

interface Options {
  setting: EventGameSetting | null;
  context: TeamScheduleContext | null;
  preview: RoundRobinSchedule | null;
  setContext: (context: TeamScheduleContext | null) => void;
  setPreview: (preview: RoundRobinSchedule | null) => void;
  loadSchedule: () => Promise<void>;
  onScheduleChanged?: (hasSchedule: boolean) => void;
}

export default function useTeamScheduleActions({
  setting,
  context,
  preview,
  setContext,
  setPreview,
  loadSchedule,
  onScheduleChanged,
}: Options) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleGeneratePreview = () => {
    if (!context) {
      return;
    }

    try {
      if (context.teams.length < 3) {
        setError("팀이 2개이면 가능한 대진이 한 경기뿐입니다.");
        return;
      }

      const currentSignature = preview
        ? getMatchOrderSignature(preview.matches)
        : getMatchOrderSignature(
            context.rounds.flatMap((round) => round.matches),
          );

      let nextSchedule: RoundRobinSchedule | null = null;

      for (let attempt = 0; attempt < 20; attempt += 1) {
        const candidate = generateRoundRobin(
          shuffleTeamsForSchedule(context.teams),
        );

        if (getMatchOrderSignature(candidate.matches) !== currentSignature) {
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
    if (!setting || !context?.formation || !preview) {
      return;
    }

    if (
      context.totalMatchCount > 0 &&
      !window.confirm(
        "기존 대진과 작성 중인 라인업을 삭제하고 다시 생성할까요?",
      )
    ) {
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const result = await saveTeamSchedule(setting.id, {
        expectedFormationVersion: context.formation.version,
        expectedScheduleVersion: context.scheduleVersion,
        schedule: preview,
      });

      setMessage(
        `${result.totalRoundCount}라운드, ${result.totalMatchCount}경기를 저장했습니다.`,
      );
      onScheduleChanged?.(result.totalMatchCount > 0);

      await loadSchedule();
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

    if (
      !window.confirm("저장된 대진표와 작성 중인 라인업을 모두 삭제할까요?")
    ) {
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      await deleteSchedule(setting.id);

      setMessage("대진표가 완전히 삭제되었습니다.");
      setContext(null);
      onScheduleChanged?.(false);

      window.dispatchEvent(new Event("scheduleDeleted"));

      await loadSchedule();
    } catch (caughtError) {
      setError(
        getScheduleErrorMessage(caughtError, "대진표를 삭제하지 못했습니다."),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return {
    isSaving,
    error,
    message,
    handleGeneratePreview,
    handleSave,
    handleDeleteSchedule,
  };
}
