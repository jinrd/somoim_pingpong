import { isValidTeamMatchFormatCount } from "./gameSettingUtils";
import type { CompetitionType } from "./types";

import styles from "./GameSettings.module.css";

interface Props {
  competitionType: CompetitionType;
  isConfirmed: boolean;
  isWorking: boolean;
  hasSetting: boolean;
  hasUnsavedChanges: boolean;
  hasUnsavedFormats: boolean;
  matchFormatCount: number;
  canConfirm: boolean;
  onConfirm: () => void;
}

export default function GameSettingFinalizePanel({
  competitionType,
  isConfirmed,
  isWorking,
  hasSetting,
  hasUnsavedChanges,
  hasUnsavedFormats,
  matchFormatCount,
  canConfirm,
  onConfirm,
}: Props) {
  if (isConfirmed) {
    return null;
  }

  const disabledReason = canConfirm
    ? undefined
    : hasUnsavedChanges
      ? "변경한 게임 설정을 먼저 임시 저장해 주세요."
      : hasUnsavedFormats
        ? "변경한 세부 경기를 먼저 저장해 주세요."
        : competitionType === "team_league" &&
            !isValidTeamMatchFormatCount(matchFormatCount)
          ? "팀 대결 세부 경기 수를 1개, 3개, 5개 중에서 선택해 주세요."
          : hasSetting
            ? undefined
            : "게임 설정을 먼저 임시 저장해 주세요.";

  return (
    <div className={styles.finalizeActions}>
      <button
        type="button"
        className={styles.confirmSettingButton}
        disabled={isWorking || !canConfirm}
        title={disabledReason}
        onClick={onConfirm}
      >
        게임 설정 최종 확정
      </button>
    </div>
  );
}
