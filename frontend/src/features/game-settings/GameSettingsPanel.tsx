import { useState } from "react";

import TeamMatchFormatsPanel from "./TeamMatchFormatsPanel";
import GameSettingConfirmDialog from "./GameSettingConfirmDialog";
import GameOperationForm from "./GameOperationForm";
import useGameSettingsData from "./useGameSettingsData";
import GameSettingsFeedback from "./GameSettingsFeedback";
import GameSettingFinalizePanel from "./GameSettingFinalizePanel";
import useMatchFormatActions from "./useMatchFormatActions";
import useGameSettingActions from "./useGameSettingActions";

import { type EventGameSetting } from "./types";

import styles from "./GameSettings.module.css";

interface Props {
  eventId: string;
  participationStatus: "open" | "closed";
  onSettingChanged?: (setting: EventGameSetting | null) => void;
  onConfigurationReset?: () => void;
}

export default function GameSettingsPanel({
  eventId,
  participationStatus,
  onSettingChanged,
  onConfigurationReset,
}: Props) {
  const {
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
  } = useGameSettingsData({
    eventId,
    onSettingChanged,
  });

  const [isWorking, setIsWorking] = useState(false);

  const {
    newFormat,
    setNewFormat,
    handleAddFormat,
    handleSaveFormats,
    handleDeleteFormat,
    handleFormatChange,
    handleReorderFormats,
  } = useMatchFormatActions({
    setting,
    teamSize: formData.teamSize,
    matchFormats,
    setMatchFormats,
    setAreFormatsDirty,
    setIsWorking,
    setError,
    setMessage,
  });

  const isConfirmed = setting?.status === "confirmed";
  const hasUnsavedSettingChanges =
    !setting ||
    formData.competitionType !== setting.competition_type ||
    formData.teamSize !== setting.team_size ||
    formData.autoTeamBalance !== setting.auto_team_balance ||
    formData.individualBestOf !== setting.individual_best_of ||
    formData.individualCountsForRanking !==
      setting.individual_counts_for_ranking ||
    formData.individualTableCount !== setting.individual_table_count;

  const {
    isConfirmSettingOpen,
    handleSaveSetting,
    handleOpenConfirmSetting,
    handleConfirmSetting,
    handleUnlockSetting,
    closeConfirmSetting,
  } = useGameSettingActions({
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
  });

  const canConfirmSetting =
    Boolean(setting) &&
    !hasUnsavedSettingChanges &&
    !areFormatsDirty &&
    (formData.competitionType === "individual_singles" ||
      matchFormats.length > 0);

  if (isLoading) {
    return <div className={styles.loading}>게임 설정을 불러오는 중입니다…</div>;
  }

  if (participationStatus !== "closed") {
    return (
      <section className={styles.panel}>
        <div className={styles.notice}>
          <strong>참가 신청 마감 후 게임 설정을 시작할 수 있습니다.</strong>
          <p>
            참석자 관리에서 게임 참가 인원을 확인하고 참가 신청 최종 마감을
            진행해 주세요.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.panel}>
      <GameSettingsFeedback
        error={error}
        message={message}
        onErrorDismiss={() => setError("")}
      />

      <GameOperationForm
        formData={formData}
        isConfirmed={isConfirmed}
        isWorking={isWorking}
        hasSetting={Boolean(setting)}
        hasUnsavedChanges={hasUnsavedSettingChanges}
        onChange={setFormData}
        onSubmit={handleSaveSetting}
        onUnlock={() => void handleUnlockSetting()}
      />

      {formData.competitionType === "team_league" && (
        <TeamMatchFormatsPanel
          hasSetting={Boolean(setting)}
          formats={matchFormats}
          newFormat={newFormat}
          isConfirmed={isConfirmed}
          isWorking={isWorking}
          isDirty={areFormatsDirty}
          onFormatChange={handleFormatChange}
          onDelete={handleDeleteFormat}
          onReorder={handleReorderFormats}
          onNewFormatChange={setNewFormat}
          onAdd={handleAddFormat}
          onSave={() => void handleSaveFormats()}
        />
      )}

      <GameSettingFinalizePanel
        competitionType={formData.competitionType}
        isConfirmed={isConfirmed}
        isWorking={isWorking}
        hasSetting={Boolean(setting)}
        hasUnsavedChanges={hasUnsavedSettingChanges}
        hasUnsavedFormats={areFormatsDirty}
        matchFormatCount={matchFormats.length}
        canConfirm={canConfirmSetting}
        onConfirm={handleOpenConfirmSetting}
      />

      <GameSettingConfirmDialog
        isOpen={isConfirmSettingOpen}
        isWorking={isWorking}
        onCancel={closeConfirmSetting}
        onConfirm={() => void handleConfirmSetting()}
      />
    </section>
  );
}
