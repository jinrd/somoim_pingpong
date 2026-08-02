import type { EventGameSetting } from "../game-settings/types";

import styles from "./SchedulePanel.module.css";

import IndividualScheduleActions from "./IndividualScheduleActions";
import IndividualScheduleContent from "./IndividualScheduleContent";
import IndividualScheduleOverview from "./IndividualScheduleOverview";
import useIndividualScheduleData from "./useIndividualScheduleData";
import useIndividualScheduleActions from "./useIndividualScheduleActions";
import ScheduleFeedback from "./ScheduleFeedback";
import ScheduleStatusPanel from "./ScheduleStatusPanel";

interface Props {
  setting: EventGameSetting | null;
  onScheduleChanged?: (hasSchedule: boolean) => void;
}

export default function IndividualSchedulePanel({
  setting,
  onScheduleChanged,
}: Props) {
  const {
    context,
    preview,
    isLoading,
    error,
    message,
    setPreview,
    setError,
    setMessage,
    loadSchedule,
  } = useIndividualScheduleData({
    setting,
    onScheduleChanged,
  });

  const {
    isSaving,
    isStarting,
    handleGeneratePreview,
    handleSave,
    handleDeleteSchedule,
    handleStartLeague,
  } = useIndividualScheduleActions({
    setting,
    context,
    preview,
    setPreview,
    setError,
    setMessage,
    loadSchedule,
    onScheduleChanged,
  });

  if (!setting) {
    return (
      <ScheduleStatusPanel message="게임 설정을 먼저 저장해 주세요." />
    );
  }

  if (setting.competition_type !== "individual_singles") {
    return (
      <ScheduleStatusPanel message="개인 단식 게임 설정을 먼저 완료해 주세요." />
    );
  }

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <h2>단식 풀리그 대진표</h2>

        <IndividualScheduleActions
          context={context}
          hasPreview={preview !== null}
          isLoading={isLoading}
          isSaving={isSaving}
          isStarting={isStarting}
          onGenerate={handleGeneratePreview}
          onSave={() => {
            void handleSave();
          }}
          onDelete={() => {
            void handleDeleteSchedule();
          }}
          onStart={() => {
            void handleStartLeague();
          }}
        />
      </header>

      {context && (
        <IndividualScheduleOverview context={context} preview={preview} />
      )}

      <ScheduleFeedback error={error} message={message} />

      <IndividualScheduleContent
        context={context}
        preview={preview}
        isLoading={isLoading}
      />
    </section>
  );
}
