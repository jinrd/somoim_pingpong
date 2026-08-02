import { useMemo } from "react";
import type { EventGameSetting } from "../game-settings/types";

import { calculateTeamQuality } from "./generateTeamFormation";

import TeamFormationBoard from "./TeamFormationBoard";
import TeamFormationSummary from "./TeamFormationSummary";
import TeamFormationControls from "./TeamFormationControls";
import TeamFormationActions from "./TeamFormationActions";
import TeamFormationConfirmDialog from "./TeamFormationConfirmDialog";
import useTeamFormationData from "./useTeamFormationData";
import useTeamFormationEditor from "./useTeamFormationEditor";
import useTeamFormationActions from "./useTeamFormationActions";
import TeamFormationFeedback from "./TeamFormationFeedback";
import TeamFormationHeader from "./TeamFormationHeader";
import TeamFormationStatusPanel from "./TeamFormationStatusPanel";

import type { TeamFormationStatus } from "./types";

import styles from "./TeamFormationPanel.module.css";

interface Props {
  setting: EventGameSetting | null;
  onFormationChanged?: (status: TeamFormationStatus | null) => void;
  onScheduleReset?: () => void;
}

export default function TeamFormationPanel({
  setting,
  onFormationChanged,
  onScheduleReset,
}: Props) {
  const {
    context,
    teams,
    history,
    method,
    status,
    warnings,
    isLoading,
    error,
    message,
    setContext,
    setTeams,
    setHistory,
    setMethod,
    setStatus,
    setWarnings,
    setIsDirty,
    setError,
    setMessage,
    reloadFormation,
  } = useTeamFormationData({
    setting,
    onFormationChanged,
  });

  const metrics = useMemo(() => calculateTeamQuality(teams), [teams]);

  const { handleGenerate, handleMoveMember, handleUndo, handleTeamNameChange } =
    useTeamFormationEditor({
      setting,
      context,
      teams,
      history,
      method,
      setTeams,
      setHistory,
      setWarnings,
      setIsDirty,
      setError,
      setMessage,
    });

  const {
    isWorking,
    isConfirmFormationOpen,
    handleSave,
    handleUnlock,
    openConfirmFormation,
    closeConfirmFormation,
  } = useTeamFormationActions({
    setting,
    context,
    teams,
    method,
    status,
    setContext,
    setTeams,
    setMethod,
    setStatus,
    setWarnings,
    setIsDirty,
    setError,
    setMessage,
    reloadFormation,
    onFormationChanged,
    onScheduleReset,
  });

  if (!setting) {
    return (
      <TeamFormationStatusPanel message="팀을 편성하려면 먼저 게임 설정을 저장해 주세요." />
    );
  }

  if (setting.competition_type !== "team_league") {
    return (
      <TeamFormationStatusPanel message="개인 단식 풀리그는 팀을 편성하지 않습니다." />
    );
  }

  if (setting.status !== "confirmed") {
    return (
      <TeamFormationStatusPanel message="게임 설정을 최종 확정하면 팀 편성을 시작할 수 있습니다." />
    );
  }

  if (isLoading) {
    return (
      <TeamFormationStatusPanel message="팀 편성 정보를 불러오는 중입니다…" />
    );
  }

  if (!context) {
    return (
      <TeamFormationStatusPanel
        message={error || "팀 편성 정보를 불러오지 못했습니다."}
        isError
        onRetry={() => void reloadFormation()}
      />
    );
  }

  return (
    <section className={styles.panel}>
      <TeamFormationHeader />

      <TeamFormationSummary
        participantCount={context.participants.length}
        teamCount={teams.length}
        metrics={metrics}
      />

      <TeamFormationFeedback
        error={error}
        message={message}
        warnings={warnings}
      />

      <TeamFormationControls
        method={method}
        isWorking={isWorking}
        isConfirmed={status === "confirmed"}
        participantCount={context.participants.length}
        canUndo={history.length > 0}
        onMethodChange={setMethod}
        onGenerate={handleGenerate}
        onUndo={handleUndo}
      />

      <TeamFormationBoard
        teams={teams}
        disabled={isWorking || status === "confirmed"}
        onMemberMove={handleMoveMember}
        onTeamNameChange={handleTeamNameChange}
      />

      <TeamFormationActions
        teams={teams}
        status={status}
        isWorking={isWorking}
        onUnlock={() => void handleUnlock()}
        onConfirmRequest={openConfirmFormation}
      />
      <TeamFormationConfirmDialog
        isOpen={isConfirmFormationOpen}
        isWorking={isWorking}
        onCancel={closeConfirmFormation}
        onConfirm={() => void handleSave("confirmed")}
      />
    </section>
  );
}
