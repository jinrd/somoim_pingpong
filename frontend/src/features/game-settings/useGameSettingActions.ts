import {
  useState,
  type Dispatch,
  type SetStateAction,
  type SubmitEvent,
} from "react";

import {
  confirmEventGameSetting,
  saveEventGameSettingDraft,
  unlockEventGameSetting,
} from "./api";
import {
  getGameSettingErrorMessage,
  toGameSettingInput,
} from "./gameSettingUtils";
import type {
  EventGameSetting,
  GameSettingInput,
  MatchFormatDraft,
} from "./types";

interface Params {
  eventId: string;
  setting: EventGameSetting | null;
  formData: GameSettingInput;
  matchFormats: MatchFormatDraft[];
  areFormatsDirty: boolean;
  hasUnsavedSettingChanges: boolean;
  setSetting: Dispatch<SetStateAction<EventGameSetting | null>>;
  setFormData: Dispatch<SetStateAction<GameSettingInput>>;
  setMatchFormats: Dispatch<SetStateAction<MatchFormatDraft[]>>;
  setAreFormatsDirty: Dispatch<SetStateAction<boolean>>;
  setIsWorking: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string>>;
  setMessage: Dispatch<SetStateAction<string>>;
  onSettingChanged?: (setting: EventGameSetting | null) => void;
  onConfigurationReset?: () => void;
}

export default function useGameSettingActions({
  eventId,
  setting,
  formData,
  matchFormats,
  areFormatsDirty,
  hasUnsavedSettingChanges,
  setSetting,
  setFormData,
  setMatchFormats,
  setAreFormatsDirty,
  setIsWorking,
  setError,
  setMessage,
  onSettingChanged,
  onConfigurationReset,
}: Params) {
  const [isConfirmSettingOpen, setConfirmSettingOpen] = useState(false);

  const hasInvalidDoublesConfiguration =
    formData.competitionType === "team_league" &&
    formData.teamSize < 2 &&
    matchFormats.some((format) => format.matchType === "doubles");

  const handleSaveSetting = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (hasInvalidDoublesConfiguration) {
      setError("복식 경기가 있으므로 팀당 인원은 2명 이상이어야 합니다.");
      return;
    }

    setIsWorking(true);
    setError("");
    setMessage("");

    try {
      const savedSetting = await saveEventGameSettingDraft(
        eventId,
        formData,
        setting?.version ?? 0,
      );

      setSetting(savedSetting);
      setFormData(toGameSettingInput(savedSetting));
      onSettingChanged?.(savedSetting);

      if (
        savedSetting.competition_type === "individual_singles" ||
        (setting && savedSetting.id !== setting.id)
      ) {
        setMatchFormats([]);
        setAreFormatsDirty(false);
      }

      setMessage("게임 설정 초안을 저장했습니다.");
    } catch (caughtError) {
      setError(
        getGameSettingErrorMessage(
          caughtError,
          "게임 설정을 저장하지 못했습니다.",
        ),
      );
    } finally {
      setIsWorking(false);
    }
  };

  const handleOpenConfirmSetting = () => {
    if (!setting) {
      setError("게임 설정 초안을 먼저 저장해 주세요.");
      return;
    }

    if (hasUnsavedSettingChanges) {
      setError("변경한 게임 설정을 먼저 '게임 설정 저장'으로 저장해 주세요.");
      return;
    }

    if (
      formData.competitionType === "team_league" &&
      matchFormats.length === 0
    ) {
      setError("팀 대결 세부 경기를 한 개 이상 저장해 주세요.");
      return;
    }

    if (areFormatsDirty) {
      setError("변경한 세부 경기를 먼저 저장해 주세요.");
      return;
    }

    if (hasInvalidDoublesConfiguration) {
      setError("복식 경기가 있으므로 팀당 인원은 2명 이상이어야 합니다.");
      return;
    }

    setError("");
    setMessage("");
    setConfirmSettingOpen(true);
  };

  const handleConfirmSetting = async () => {
    if (!setting) {
      setConfirmSettingOpen(false);
      setError("게임 설정 초안을 먼저 저장해 주세요.");
      return;
    }

    setConfirmSettingOpen(false);
    setIsWorking(true);
    setError("");
    setMessage("");

    try {
      const confirmedSetting = await confirmEventGameSetting(
        setting.id,
        setting.version,
      );

      setSetting(confirmedSetting);
      setFormData(toGameSettingInput(confirmedSetting));
      onSettingChanged?.(confirmedSetting);
      setMessage("게임 설정을 최종 확정했습니다.");
    } catch (caughtError) {
      setError(
        getGameSettingErrorMessage(
          caughtError,
          "게임 설정을 확정하지 못했습니다.",
        ),
      );
    } finally {
      setIsWorking(false);
    }
  };

  const handleUnlockSetting = async () => {
    if (!setting || setting.status !== "confirmed") {
      return;
    }

    if (
      !window.confirm(
        "게임 설정 수정을 시작할까요?\n\n세부 경기, 팀 편성, 대진표와 라인업이 모두 초기화되며 되돌릴 수 없습니다. 현재 기본 설정은 새 초안으로 유지됩니다.",
      )
    ) {
      return;
    }

    setIsWorking(true);
    setError("");
    setMessage("");

    try {
      const draftSetting = await unlockEventGameSetting(
        setting.id,
        setting.version,
      );

      setSetting(draftSetting);
      setFormData(toGameSettingInput(draftSetting));
      setMatchFormats([]);
      setAreFormatsDirty(false);
      onSettingChanged?.(draftSetting);
      onConfigurationReset?.();
      setMessage(
        "기존 경기 구성을 초기화하고 게임 설정을 초안으로 전환했습니다.",
      );
    } catch (caughtError) {
      setError(
        getGameSettingErrorMessage(
          caughtError,
          "게임 설정 수정을 시작하지 못했습니다.",
        ),
      );
    } finally {
      setIsWorking(false);
    }
  };

  return {
    isConfirmSettingOpen,
    handleSaveSetting,
    handleOpenConfirmSetting,
    handleConfirmSetting,
    handleUnlockSetting,
    closeConfirmSetting: () => setConfirmSettingOpen(false),
  };
}
