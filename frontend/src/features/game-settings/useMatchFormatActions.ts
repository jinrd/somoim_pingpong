import type { Dispatch, SetStateAction } from "react";

import { saveMatchFormats } from "./api";
import { DEFAULT_MATCH_FORMAT_INPUT } from "./constants";
import {
  getGameSettingErrorMessage,
  isValidTeamMatchFormatCount,
  toMatchFormatDraft,
} from "./gameSettingUtils";
import type { EventGameSetting, MatchFormatDraft } from "./types";

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
  const handleFormatCountChange = (count: number) => {
    if (!setting) {
      setError("먼저 회차 게임 설정을 저장해 주세요.");
      return;
    }

    if (!isValidTeamMatchFormatCount(count)) {
      setError("팀 대결 세부 경기 수는 1개, 3개, 5개 중에서 선택해 주세요.");
      return;
    }

    if (count === matchFormats.length) {
      return;
    }

    setError("");
    setMatchFormats((currentFormats) => {
      const nextFormats = currentFormats.slice(0, count);

      while (nextFormats.length < count) {
        nextFormats.push({
          key: crypto.randomUUID(),
          ...DEFAULT_MATCH_FORMAT_INPUT,
        });
      }

      return nextFormats;
    });
    setAreFormatsDirty(true);
    setMessage(`세부 경기를 ${count}개로 변경했습니다. 저장해 주세요.`);
  };

  const handleSaveFormats = async () => {
    if (!setting) {
      setError("먼저 회차 게임 설정을 저장해 주세요.");
      return;
    }

    if (!isValidTeamMatchFormatCount(matchFormats.length)) {
      setError(
        "팀 대결 세부 경기 수는 1개, 3개, 5개 중에서 선택해 주세요.",
      );
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
    handleFormatCountChange,
    handleSaveFormats,
    handleFormatChange,
    handleReorderFormats,
  };
}
