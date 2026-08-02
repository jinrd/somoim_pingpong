import { useState, type Dispatch, type SetStateAction } from "react";

import { saveMatchFormats } from "./api";
import { DEFAULT_MATCH_FORMAT_INPUT } from "./constants";
import {
  getGameSettingErrorMessage,
  toMatchFormatDraft,
} from "./gameSettingUtils";
import type {
  EventGameSetting,
  MatchFormatDraft,
  MatchFormatInput,
} from "./types";

interface Params {
  setting: EventGameSetting | null;
  teamSize: number;
  matchFormats: MatchFormatDraft[];
  setMatchFormats: Dispatch<SetStateAction<MatchFormatDraft[]>>;
  setAreFormatsDirty: Dispatch<SetStateAction<boolean>>;
  setIsWorking: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string>>;
  setMessage: Dispatch<SetStateAction<string>>;
}

export default function useMatchFormatActions({
  setting,
  teamSize,
  matchFormats,
  setMatchFormats,
  setAreFormatsDirty,
  setIsWorking,
  setError,
  setMessage,
}: Params) {
  const [newFormat, setNewFormat] = useState<MatchFormatInput>(
    DEFAULT_MATCH_FORMAT_INPUT,
  );

  const handleAddFormat = () => {
    if (!setting) {
      setError("먼저 회차 게임 설정을 저장해 주세요.");
      return;
    }

    if (newFormat.matchType === "doubles" && teamSize < 2) {
      setError("복식 경기를 추가하려면 팀당 인원이 2명 이상이어야 합니다.");
      return;
    }

    setError("");
    setMatchFormats((currentFormats) => [
      ...currentFormats,
      {
        key: crypto.randomUUID(),
        ...newFormat,
      },
    ]);
    setNewFormat(DEFAULT_MATCH_FORMAT_INPUT);
    setAreFormatsDirty(true);
    setMessage("경기를 목록에 추가했습니다. 저장을 눌러 반영해 주세요.");
  };

  const handleSaveFormats = async () => {
    if (!setting) {
      setError("먼저 회차 게임 설정을 저장해 주세요.");
      return;
    }

    if (
      teamSize < 2 &&
      matchFormats.some((format) => format.matchType === "doubles")
    ) {
      setError("복식 경기가 있으므로 팀당 인원은 2명 이상이어야 합니다.");
      return;
    }

    setIsWorking(true);
    setError("");
    setMessage("");

    try {
      const savedFormats = await saveMatchFormats(
        setting.id,
        matchFormats.map(({ id, matchType, bestOf, countsForRanking }) => ({
          id,
          matchType,
          bestOf,
          countsForRanking,
        })),
      );

      setMatchFormats(savedFormats.map(toMatchFormatDraft));
      setAreFormatsDirty(false);
      setMessage("세부 경기 전체를 저장했습니다.");
    } catch (caughtError) {
      setError(
        getGameSettingErrorMessage(
          caughtError,
          "세부 경기 전체를 저장하지 못했습니다.",
        ),
      );
    } finally {
      setIsWorking(false);
    }
  };

  const handleDeleteFormat = (formatKey: string) => {
    setError("");
    setMatchFormats((currentFormats) =>
      currentFormats.filter((format) => format.key !== formatKey),
    );
    setAreFormatsDirty(true);
    setMessage("경기를 목록에서 삭제했습니다. 저장을 눌러 반영해 주세요.");
  };

  const handleFormatChange = (updatedFormat: MatchFormatDraft) => {
    setMatchFormats((currentFormats) =>
      currentFormats.map((currentFormat) =>
        currentFormat.key === updatedFormat.key ? updatedFormat : currentFormat,
      ),
    );
    setAreFormatsDirty(true);
    setMessage("세부 경기를 변경했습니다. 저장을 눌러 반영해 주세요.");
  };

  const handleReorderFormats = (reorderedFormats: MatchFormatDraft[]) => {
    setMatchFormats(reorderedFormats);
    setAreFormatsDirty(true);
    setError("");
    setMessage("경기 순서를 변경했습니다. 저장을 눌러 반영해 주세요.");
  };

  return {
    newFormat,
    setNewFormat,
    handleAddFormat,
    handleSaveFormats,
    handleDeleteFormat,
    handleFormatChange,
    handleReorderFormats,
  };
}
