import { useCallback, useEffect, useState } from "react";

import {
  Activity,
  Archive,
  ArrowLeft,
  CalendarDays,
  CircleStop,
  ListOrdered,
  Loader2,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";

import TeamSchedulePanel from "../../features/match-schedule/TeamSchedulePanel";

import { useNavigate, useParams } from "react-router-dom";
import TeamFormationPanel from "../../features/team-formation/TeamFormationPanel";
import type { TeamFormationStatus } from "../../features/team-formation/types";

import type { EventGameSetting } from "../../features/game-settings/types";
import ParticipantManager from "../../features/events/ParticipantManager";
import PublicLinkManager from "../../features/events/PublicLinkManager";
import {
  archiveEvent,
  deleteEvent,
  forceCompleteEvent,
  getEvent,
} from "../../features/events/api";
import GameSettingsPanel from "../../features/game-settings/GameSettingsPanel";
import IndividualSchedulePanel from "../../features/match-schedule/IndividualSchedulePanel";
import {
  getIndividualSchedule,
  getTeamSchedule,
} from "../../features/match-schedule/api";

import {
  EVENT_STATUS_LABELS,
  type SomoimEvent,
} from "../../features/events/types";

import styles from "../../features/events/Events.module.css";

import MatchMonitorPanel from "../../features/match-monitor/MatchMonitorPanel";
import MatchResultsPanel from "../../features/match-results/MatchResultsPanel";
import LeagueStandingsPanel from "../../features/standings/LeagueStandingsPanel";

const formatEventDate = (eventDate: string): string => {
  const parsedDate = new Date(eventDate);

  if (Number.isNaN(parsedDate.getTime())) {
    return eventDate;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(parsedDate);
};

export default function EventDetail() {
  const { eventId } = useParams<{
    eventId: string;
  }>();

  const navigate = useNavigate();

  const [eventRecord, setEventRecord] = useState<SomoimEvent | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [isArchiving, setIsArchiving] = useState(false);
  const [isArchiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveError, setArchiveError] = useState("");
  const [isForceCompleting, setIsForceCompleting] = useState(false);
  const [isForceCompleteDialogOpen, setForceCompleteDialogOpen] =
    useState(false);
  const [forceCompleteError, setForceCompleteError] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<
    "participants" | "game-settings" | "schedule" | "monitor"
  >("participants");
  const [configurationView, setConfigurationView] = useState<
    "settings" | "formation"
  >("settings");
  const [scheduleView, setScheduleView] = useState<
    "schedule" | "results" | "standings"
  >("schedule");

  const [gameSetting, setGameSetting] = useState<EventGameSetting | null>(null);
  const [formationStatus, setFormationStatus] =
    useState<TeamFormationStatus | null>(null);
  const [hasSchedule, setHasSchedule] = useState(false);
  const [configurationRevision, setConfigurationRevision] = useState(0);

  const handleGameConfigurationReset = useCallback(() => {
    setGameSetting(null);
    setFormationStatus(null);
    setHasSchedule(false);
    setConfigurationRevision((current) => current + 1);
  }, []);

  const handleSettingChanged = useCallback(
    (nextSetting: EventGameSetting | null) => {
      setGameSetting(nextSetting);
      setHasSchedule(false);

      if (
        !nextSetting ||
        nextSetting.status !== "confirmed" ||
        nextSetting.competition_type !== "team_league"
      ) {
        setFormationStatus(null);
      }
    },
    [],
  );

  const handleSettingConfigurationReset = useCallback(() => {
    setFormationStatus(null);
    setHasSchedule(false);
  }, []);

  const handleScheduleReset = useCallback(() => {
    setHasSchedule(false);
  }, []);

  const refreshEventRecord = useCallback(async () => {
    if (!eventId) {
      return;
    }

    const latestEvent = await getEvent(eventId);
    setEventRecord(latestEvent);
  }, [eventId]);

  const isScheduleAvailable =
    gameSetting?.status === "confirmed" &&
    (gameSetting.competition_type === "individual_singles" ||
      formationStatus === "confirmed");

  const handleDeleteEvent = async () => {
    if (!eventRecord || eventRecord.status !== "draft") {
      return;
    }

    setIsDeleting(true);
    setDeleteError("");

    try {
      await deleteEvent(eventRecord.id, eventRecord.version);
      navigate("/events", { replace: true });
    } catch (caughtError) {
      setDeleteError(
        caughtError instanceof Error
          ? caughtError.message
          : "회차를 삭제하지 못했습니다.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleArchiveEvent = async () => {
    if (!eventRecord || eventRecord.status !== "completed") {
      return;
    }

    setIsArchiving(true);
    setArchiveError("");

    try {
      const archivedEvent = await archiveEvent(
        eventRecord.id,
        eventRecord.version,
      );

      setEventRecord(archivedEvent);
      setArchiveDialogOpen(false);
    } catch (caughtError) {
      setArchiveError(
        caughtError instanceof Error
          ? caughtError.message
          : "회차를 보관하지 못했습니다.",
      );
    } finally {
      setIsArchiving(false);
    }
  };

  const handleForceCompleteEvent = async () => {
    if (!eventRecord || eventRecord.status !== "active") {
      return;
    }

    setIsForceCompleting(true);
    setForceCompleteError("");

    try {
      const completedEvent = await forceCompleteEvent(
        eventRecord.id,
        eventRecord.version,
      );

      setEventRecord(completedEvent);
      setForceCompleteDialogOpen(false);
    } catch (caughtError) {
      setForceCompleteError(
        caughtError instanceof Error
          ? caughtError.message
          : "회차를 강제로 종료하지 못했습니다.",
      );
    } finally {
      setIsForceCompleting(false);
    }
  };

  useEffect(() => {
    if (!gameSetting || !isScheduleAvailable) {
      return;
    }

    let cancelled = false;
    const request =
      gameSetting.competition_type === "team_league"
        ? getTeamSchedule(gameSetting.id)
        : getIndividualSchedule(gameSetting.id);

    request
      .then((schedule) => {
        if (!cancelled) {
          setHasSchedule(schedule.totalMatchCount > 0);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasSchedule(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [gameSetting, isScheduleAvailable]);

  useEffect(() => {
    if (!eventId) {
      return;
    }

    let cancelled = false;

    getEvent(eventId)
      .then((record) => {
        if (!cancelled) {
          setEventRecord(record);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("회차 정보를 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  useEffect(() => {
    if (!eventId || eventRecord?.status === "archived") {
      return;
    }

    let cancelled = false;
    let isRequesting = false;

    const refreshEventStatus = async () => {
      if (
        cancelled ||
        isRequesting ||
        document.visibilityState !== "visible"
      ) {
        return;
      }

      isRequesting = true;

      try {
        const latestEvent = await getEvent(eventId);

        if (!cancelled) {
          setEventRecord(latestEvent);
        }
      } catch {
        // 자동 갱신 실패 시 현재 화면을 유지합니다.
      } finally {
        isRequesting = false;
      }
    };

    const intervalId = window.setInterval(() => {
      void refreshEventStatus();
    }, 5_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshEventStatus();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, [eventId, eventRecord?.status]);

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
      <header className={styles.detailHeader}>
        <div className={styles.detailHeaderContent}>
          <span className={styles.detailStatus}>
            {EVENT_STATUS_LABELS[eventRecord.status]}
          </span>

          <h1>{eventRecord.title}</h1>

          <div className={styles.detailDate}>
            <CalendarDays size={18} aria-hidden="true" />

            <time dateTime={eventRecord.event_date}>
              {formatEventDate(eventRecord.event_date)}
            </time>
          </div>

          {eventRecord.notice && (
            <p className={styles.detailNotice}>{eventRecord.notice}</p>
          )}
        </div>

        {eventRecord.status === "draft" && (
          <button
            type="button"
            className={styles.dangerButton}
            disabled={isDeleting}
            onClick={() => {
              setDeleteError("");
              setDeleteDialogOpen(true);
            }}
          >
            <Trash2 size={17} aria-hidden="true" />
            회차 삭제
          </button>
        )}

        {eventRecord.status === "completed" && (
          <button
            type="button"
            className={styles.archiveButton}
            disabled={isArchiving}
            onClick={() => {
              setArchiveError("");
              setArchiveDialogOpen(true);
            }}
          >
            <Archive size={17} aria-hidden="true" />
            회차 보관
          </button>
        )}

        {eventRecord.status === "active" && (
          <button
            type="button"
            className={styles.dangerButton}
            disabled={isForceCompleting}
            onClick={() => {
              setForceCompleteError("");
              setForceCompleteDialogOpen(true);
            }}
          >
            <CircleStop size={17} aria-hidden="true" />
            회차 강제 종료
          </button>
        )}
      </header>
      {eventRecord.status !== "archived" && (
        <PublicLinkManager
          eventRecord={eventRecord}
          onEventUpdated={setEventRecord}
        />
      )}
      <nav className={styles.detailTabs} aria-label="회차 관리 메뉴">
        <button
          type="button"
          className={`${styles.detailTab} ${
            activeTab === "participants" ? styles.detailTabActive : ""
          }`}
          aria-current={activeTab === "participants" ? "page" : undefined}
          onClick={() => {
            setActiveTab("participants");
          }}
        >
          <Users size={18} aria-hidden="true" />
          <span className={styles.tabLabelDesktop}>참석자 관리</span>
          <span className={styles.tabLabelMobile}>참석자</span>
        </button>

        <button
          type="button"
          className={`${styles.detailTab} ${
            activeTab === "game-settings" ? styles.detailTabActive : ""
          }`}
          aria-current={activeTab === "game-settings" ? "page" : undefined}
          onClick={() => {
            setActiveTab("game-settings");
          }}
        >
          <Trophy size={18} aria-hidden="true" />
          <span className={styles.tabLabelDesktop}>게임 설정/팀 편성</span>
          <span className={styles.tabLabelMobile}>게임 설정</span>
        </button>

        <button
          type="button"
          className={`${styles.detailTab} ${
            activeTab === "schedule" ? styles.detailTabActive : ""
          }`}
          aria-current={activeTab === "schedule" ? "page" : undefined}
          disabled={!isScheduleAvailable}
          title={
            isScheduleAvailable
              ? undefined
              : gameSetting?.competition_type === "team_league"
                ? "게임 설정과 팀 편성을 최종 확정해 주세요."
                : "게임 설정을 최종 확정해 주세요."
          }
          onClick={() => {
            if (isScheduleAvailable) {
              setActiveTab("schedule");
            }
          }}
        >
          <ListOrdered size={18} aria-hidden="true" />
          <span className={styles.tabLabelDesktop}>대진표/결과</span>
          <span className={styles.tabLabelMobile}>대진·결과</span>
        </button>
        <button
          type="button"
          className={`${styles.detailTab} ${
            activeTab === "monitor" ? styles.detailTabActive : ""
          }`}
          aria-current={activeTab === "monitor" ? "page" : undefined}
          disabled={!hasSchedule}
          title={
            hasSchedule
              ? undefined
              : "대진표를 저장한 후 경기 진행을 시작할 수 있습니다."
          }
          onClick={() => {
            if (hasSchedule) {
              setActiveTab("monitor");
            }
          }}
        >
          <Activity size={18} aria-hidden="true" />
          <span className={styles.tabLabelDesktop}>경기 진행</span>
          <span className={styles.tabLabelMobile}>경기 진행</span>
        </button>
      </nav>
      <div
        className={styles.tabPanel}
        style={{ display: activeTab === "participants" ? "block" : "none" }}
      >
        <ParticipantManager
          eventRecord={eventRecord}
          hasGameConfiguration={Boolean(gameSetting)}
          onEventUpdated={setEventRecord}
          onGameConfigurationReset={handleGameConfigurationReset}
        />
      </div>
      <div
        className={styles.tabPanel}
        style={{ display: activeTab === "game-settings" ? "block" : "none" }}
      >
        <nav className={styles.mobileSectionTabs} aria-label="게임 설정 메뉴">
          <button
            type="button"
            className={
              configurationView === "settings"
                ? styles.mobileSectionTabActive
                : styles.mobileSectionTab
            }
            onClick={() => {
              setConfigurationView("settings");
            }}
          >
            게임 설정
          </button>

          <button
            type="button"
            className={
              configurationView === "formation"
                ? styles.mobileSectionTabActive
                : styles.mobileSectionTab
            }
            onClick={() => {
              setConfigurationView("formation");
            }}
          >
            팀 편성
          </button>
        </nav>

        <div
          className={`${styles.mobileSectionPanel} ${
            configurationView === "settings"
              ? styles.mobileSectionPanelActive
              : ""
          }`}
        >
          <GameSettingsPanel
            key={`settings-${configurationRevision}`}
            eventId={eventId}
            participationStatus={eventRecord.participation_status}
            onSettingChanged={handleSettingChanged}
            onConfigurationReset={handleSettingConfigurationReset}
          />
        </div>

        <div
          className={`${styles.mobileSectionPanel} ${
            configurationView === "formation"
              ? styles.mobileSectionPanelActive
              : ""
          }`}
        >
          <TeamFormationPanel
            key={`formation-${configurationRevision}-${gameSetting?.id ?? "none"}`}
            setting={gameSetting}
            onFormationChanged={setFormationStatus}
            onScheduleReset={handleScheduleReset}
          />
        </div>
      </div>

      {activeTab === "schedule" && (
        <div className={styles.tabPanel}>
          <nav className={styles.mobileSectionTabs} aria-label="대진 결과 메뉴">
            <button
              type="button"
              className={
                scheduleView === "schedule"
                  ? styles.mobileSectionTabActive
                  : styles.mobileSectionTab
              }
              onClick={() => {
                setScheduleView("schedule");
              }}
            >
              대진표
            </button>

            <button
              type="button"
              className={
                scheduleView === "results"
                  ? styles.mobileSectionTabActive
                  : styles.mobileSectionTab
              }
              onClick={() => {
                setScheduleView("results");
              }}
            >
              경기 결과
            </button>

            <button
              type="button"
              className={
                scheduleView === "standings"
                  ? styles.mobileSectionTabActive
                  : styles.mobileSectionTab
              }
              onClick={() => {
                setScheduleView("standings");
              }}
            >
              순위표
            </button>
          </nav>

          <div
            className={`${styles.mobileSectionPanel} ${
              scheduleView === "schedule"
                ? styles.mobileSectionPanelActive
                : ""
            }`}
          >
            {gameSetting?.competition_type === "team_league" ? (
              <TeamSchedulePanel
                setting={gameSetting}
                onScheduleChanged={setHasSchedule}
              />
            ) : gameSetting?.competition_type === "individual_singles" ? (
              <IndividualSchedulePanel
                setting={gameSetting}
                onScheduleChanged={setHasSchedule}
              />
            ) : null}
          </div>

          <div
            className={`${styles.mobileSectionPanel} ${
              scheduleView === "results"
                ? styles.mobileSectionPanelActive
                : ""
            }`}
          >
            {gameSetting && <MatchResultsPanel setting={gameSetting} />}
          </div>

          <div
            className={`${styles.mobileSectionPanel} ${
              scheduleView === "standings"
                ? styles.mobileSectionPanelActive
                : ""
            }`}
          >
            {gameSetting && <LeagueStandingsPanel setting={gameSetting} />}
          </div>
        </div>
      )}

      {activeTab === "monitor" && hasSchedule && (
        <div className={styles.tabPanel}>
          <MatchMonitorPanel
            setting={gameSetting}
            onEventStatusChanged={refreshEventRecord}
          />
        </div>
      )}

      {isDeleteDialogOpen && (
        <div className={styles.confirmOverlay}>
          <section
            className={styles.confirmDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-event-title"
            aria-describedby="delete-event-description"
          >
            <h2 id="delete-event-title">회차를 삭제할까요?</h2>

            <p id="delete-event-description">
              {eventRecord.title} 회차와 참석자, 게임 설정, 팀 편성 및
              저장된 대진이 모두 삭제됩니다.
            </p>

            <p>삭제한 내용은 되돌릴 수 없습니다.</p>

            {deleteError && (
              <p className={styles.formError} role="alert">
                {deleteError}
              </p>
            )}

            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.cancelButton}
                disabled={isDeleting}
                onClick={() => {
                  setDeleteError("");
                  setDeleteDialogOpen(false);
                }}
              >
                취소
              </button>

              <button
                type="button"
                className={styles.confirmCloseButton}
                disabled={isDeleting}
                onClick={() => {
                  void handleDeleteEvent();
                }}
              >
                {isDeleting ? (
                  <Loader2
                    size={17}
                    className={styles.spinner}
                    aria-hidden="true"
                  />
                ) : (
                  <Trash2 size={17} aria-hidden="true" />
                )}
                삭제
              </button>
            </div>
          </section>
        </div>
      )}

      {isArchiveDialogOpen && (
        <div className={styles.confirmOverlay}>
          <section
            className={styles.confirmDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="archive-event-title"
            aria-describedby="archive-event-description"
          >
            <h2 id="archive-event-title">종료된 회차를 보관할까요?</h2>

            <p id="archive-event-description">
              경기 및 결과 기록은 그대로 유지되고 공개 링크는 비활성화됩니다.
            </p>

            <p>보관한 회차는 다시 진행 상태로 되돌릴 수 없습니다.</p>

            {archiveError && (
              <p className={styles.formError} role="alert">
                {archiveError}
              </p>
            )}

            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.cancelButton}
                disabled={isArchiving}
                onClick={() => {
                  setArchiveError("");
                  setArchiveDialogOpen(false);
                }}
              >
                취소
              </button>

              <button
                type="button"
                className={styles.confirmArchiveButton}
                disabled={isArchiving}
                onClick={() => {
                  void handleArchiveEvent();
                }}
              >
                {isArchiving ? (
                  <Loader2
                    size={17}
                    className={styles.spinner}
                    aria-hidden="true"
                  />
                ) : (
                  <Archive size={17} aria-hidden="true" />
                )}
                보관
              </button>
            </div>
          </section>
        </div>
      )}

      {isForceCompleteDialogOpen && (
        <div className={styles.confirmOverlay}>
          <section
            className={styles.confirmDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="force-complete-event-title"
            aria-describedby="force-complete-event-description"
          >
            <h2 id="force-complete-event-title">회차를 강제로 종료할까요?</h2>

            <p id="force-complete-event-description">
              완료된 경기 결과는 유지되고, 아직 끝나지 않은 모든 경기는
              취소됩니다.
            </p>

            <p>취소된 경기는 자동으로 다시 시작되지 않습니다.</p>

            {forceCompleteError && (
              <p className={styles.formError} role="alert">
                {forceCompleteError}
              </p>
            )}

            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.cancelButton}
                disabled={isForceCompleting}
                onClick={() => {
                  setForceCompleteError("");
                  setForceCompleteDialogOpen(false);
                }}
              >
                돌아가기
              </button>

              <button
                type="button"
                className={styles.confirmCloseButton}
                disabled={isForceCompleting}
                onClick={() => {
                  void handleForceCompleteEvent();
                }}
              >
                {isForceCompleting ? (
                  <Loader2
                    size={17}
                    className={styles.spinner}
                    aria-hidden="true"
                  />
                ) : (
                  <CircleStop size={17} aria-hidden="true" />
                )}
                남은 경기 취소 후 종료
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
