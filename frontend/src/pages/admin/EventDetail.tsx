import { ArrowLeft } from "lucide-react";

import { useNavigate, useParams } from "react-router-dom";

import EventManagementTabs from "../../features/events/EventManagementTabs";

import styles from "../../features/events/Events.module.css";

import EventDetailHeader from "../../features/events/EventDetailHeader";
import EventManagementContent from "../../features/events/EventManagementContent";
import EventLifecycleDialogs from "../../features/events/EventLifecycleDialogs";
import { useEventLifecycleActions } from "../../features/events/useEventLifecycleActions";
import { useEventDetail } from "../../features/events/useEventDetail";
import { useEventManagementState } from "../../features/events/useEventManagementState";
export default function EventDetail() {
  const { eventId } = useParams<{
    eventId: string;
  }>();
  const { eventRecord, setEventRecord, isLoading, error, refreshEventRecord } =
    useEventDetail(eventId);

  const {
    activeStep: activeTab,
    setActiveStep: setActiveTab,
    gameSetting,
    workflow,
    configurationRevision,
    handleGameConfigurationReset,
    handleSettingConfigurationReset,
    handleSettingChanged,
    handleScheduleReset,
    setFormationStatus,
    setHasSchedule,
  } = useEventManagementState(eventId);

  const navigate = useNavigate();

  const lifecycle = useEventLifecycleActions({
    eventRecord,
    onEventUpdated: setEventRecord,
    onEventDeleted: () => {
      navigate("/events", { replace: true });
    },
  });

  if (!eventId) {
    return (
      <div className={styles.emptyPanel}>
        <h2>회차를 불러올 수 없습니다.</h2>
        <p>잘못된 회차 주소입니다.</p>

        <button
          type="button"
          className={styles.cancelButton}
          onClick={() => {
            navigate("/events");
          }}
        >
          회차 목록으로 돌아가기
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.emptyPanel}>회차 정보를 불러오는 중입니다…</div>
    );
  }

  if (error || !eventRecord) {
    return (
      <div className={styles.emptyPanel}>
        <h2>회차를 불러올 수 없습니다.</h2>
        <p>{error}</p>

        <button
          type="button"
          className={styles.cancelButton}
          onClick={() => {
            navigate("/events");
          }}
        >
          회차 목록으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <section className={styles.page}>
      <button
        type="button"
        className={styles.backButton}
        onClick={() => {
          navigate("/events");
        }}
      >
        <ArrowLeft size={18} aria-hidden="true" />
        회차 목록
      </button>
      <EventDetailHeader
        eventRecord={eventRecord}
        isDeleting={lifecycle.isDeleting}
        isArchiving={lifecycle.isArchiving}
        isForceCompleting={lifecycle.isForceCompleting}
        onDeleteRequest={lifecycle.openDeleteDialog}
        onArchiveRequest={lifecycle.openArchiveDialog}
        onForceCompleteRequest={lifecycle.openForceCompleteDialog}
      />

      <EventManagementTabs
        activeStep={activeTab}
        workflow={workflow}
        onStepChange={setActiveTab}
      />
      <EventManagementContent
        activeStep={activeTab}
        eventId={eventId}
        eventRecord={eventRecord}
        gameSetting={gameSetting}
        workflow={workflow}
        configurationRevision={configurationRevision}
        onEventUpdated={setEventRecord}
        onGameConfigurationReset={handleGameConfigurationReset}
        onSettingChanged={handleSettingChanged}
        onSettingConfigurationReset={handleSettingConfigurationReset}
        onFormationChanged={setFormationStatus}
        onScheduleReset={handleScheduleReset}
        onScheduleChanged={setHasSchedule}
        onEventStatusChanged={refreshEventRecord}
      />
      <EventLifecycleDialogs
        eventRecord={eventRecord}
        deleteDialog={lifecycle.deleteDialog}
        archiveDialog={lifecycle.archiveDialog}
        forceCompleteDialog={lifecycle.forceCompleteDialog}
      />
    </section>
  );
}
