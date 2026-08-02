import type { EventGameSetting } from "../game-settings/types";

import {
  TeamSchedulePreviewRounds,
  TeamScheduleStoredRounds,
} from "./TeamScheduleRounds";
import TeamScheduleOverview from "./TeamScheduleOverview";
import TeamScheduleActions from "./TeamScheduleActions";
import ScheduleStatusPanel from "./ScheduleStatusPanel";
import ScheduleFeedback from "./ScheduleFeedback";
import useTeamScheduleData from "./useTeamScheduleData";
import useTeamScheduleActions from "./useTeamScheduleActions";
import styles from "./SchedulePanel.module.css";

interface Props {
  setting: EventGameSetting | null;
  onScheduleChanged?: (hasSchedule: boolean) => void;
}

export default function TeamSchedulePanel({
  setting,
  onScheduleChanged,
}: Props) {
  const {
    context,
    preview,
    isLoading,
    loadError,
    setContext,
    setPreview,
    loadSchedule,
  } = useTeamScheduleData({
    setting,
    onScheduleChanged,
  });

  const {
    isSaving,
    error,
    message,
    handleGeneratePreview,
    handleSave,
    handleDeleteSchedule,
  } = useTeamScheduleActions({
    setting,
    context,
    preview,
    setContext,
    setPreview,
    loadSchedule,
    onScheduleChanged,
  });

  if (!setting) {
    return (
      <ScheduleStatusPanel message="게임 설정을 먼저 저장해 주세요." />
    );
  }

  if (setting.competition_type !== "team_league") {
    return (
      <ScheduleStatusPanel message="개인 단식 대진표를 불러오는 중입니다." />
    );
  }

  if (isLoading) {
    return <ScheduleStatusPanel message="대진 정보를 불러오는 중입니다…" />;
  }

  if (!context) {
    return (
      <ScheduleStatusPanel
        message={loadError || "대진 정보를 불러오지 못했습니다."}
        isError
        onRetry={() => {
          void loadSchedule();
        }}
      />
    );
  }

  if (!context.formation) {
    return <ScheduleStatusPanel message="먼저 팀원을 세팅해 주세요." />;
  }

  if (context.formation.status !== "confirmed") {
    return (
      <ScheduleStatusPanel message="팀원 세팅을 완료한 후 대진표를 만들 수 있습니다." />
    );
  }

  return (
    <section className={styles.panel}>
      <ScheduleFeedback error={error} message={message} />

      <TeamScheduleOverview
        context={context}
        preview={preview}
      />

      <TeamScheduleActions
        context={context}
        preview={preview}
        isSaving={isSaving}
        onGenerate={handleGeneratePreview}
        onSave={() => {
          void handleSave();
        }}
        onDelete={() => {
          void handleDeleteSchedule();
        }}
      />

      {preview ? (
        <TeamSchedulePreviewRounds
          rounds={preview.rounds}
          formats={context.formats}
        />
      ) : (
        <TeamScheduleStoredRounds rounds={context.rounds} />
      )}
    </section>
  );
}
