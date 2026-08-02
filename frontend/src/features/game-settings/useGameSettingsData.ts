import { useEffect, useState } from "react";

import { getEventGameConfiguration } from "./api";
import { DEFAULT_GAME_SETTING_INPUT } from "./constants";
import {
  getGameSettingErrorMessage,
  toGameSettingInput,
  toMatchFormatDraft,
} from "./gameSettingUtils";
import type {
  EventGameSetting,
  GameSettingInput,
  MatchFormatDraft,
} from "./types";

interface Params {
  eventId: string;
  onSettingChanged?: (setting: EventGameSetting | null) => void;
}

export default function useGameSettingsData({
  eventId,
  onSettingChanged,
}: Params) {
  const [setting, setSetting] = useState<EventGameSetting | null>(null);
  const [matchFormats, setMatchFormats] = useState<MatchFormatDraft[]>([]);
  const [formData, setFormData] = useState<GameSettingInput>(
    DEFAULT_GAME_SETTING_INPUT,
  );
  const [areFormatsDirty, setAreFormatsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    const timeoutId = window.setTimeout(() => {
      setIsLoading(true);
      setError("");
      setMessage("");

      getEventGameConfiguration(eventId)
        .then((configuration) => {
          if (cancelled) {
            return;
          }

          setSetting(configuration.setting);
          onSettingChanged?.(configuration.setting);
          setMatchFormats(configuration.matchFormats.map(toMatchFormatDraft));
          setAreFormatsDirty(false);

          if (configuration.setting) {
            setFormData(toGameSettingInput(configuration.setting));
          } else {
            setFormData(DEFAULT_GAME_SETTING_INPUT);
          }
        })
        .catch((caughtError) => {
          if (!cancelled) {
            setError(
              getGameSettingErrorMessage(
                caughtError,
                "게임 설정을 불러오지 못했습니다.",
              ),
            );
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoading(false);
          }
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [eventId, onSettingChanged]);

  return {
    setting,
    matchFormats,
    formData,
    areFormatsDirty,
    isLoading,
    error,
    message,
    setSetting,
    setMatchFormats,
    setFormData,
    setAreFormatsDirty,
    setError,
    setMessage,
  };
}
