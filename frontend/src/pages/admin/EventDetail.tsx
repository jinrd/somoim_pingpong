import { useCallback, useEffect, useState } from "react";

import {
  ArrowLeft,
  CalendarDays,
  ListOrdered,
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
import { getEvent } from "../../features/events/api";
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

import { Activity } from "lucide-react";

import MatchMonitorPanel from "../../features/match-monitor/MatchMonitorPanel";

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
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<
    "participants" | "game-settings" | "schedule" | "monitor"
  >("participants");

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

  const isScheduleAvailable =
    gameSetting?.status === "confirmed" &&
    (gameSetting.competition_type === "individual_singles" ||
      formationStatus === "confirmed");

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
        <div>
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
      </header>
      <PublicLinkManager
        eventRecord={eventRecord}
        onEventUpdated={setEventRecord}
      />
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
          참석자 관리
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
          게임 설정/팀 편성
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
          대진표/결과
        </button>
        <button
          type="button"
          className={`${styles.detailTab} ${
            activeTab === "monitor" ? styles.detailTabActive : ""
          }`}
          aria-current={activeTab === "monitor" ? "page" : undefined}
          disabled={!hasSchedule}
          title={
            hasSchedule ? undefined : "대진표를 저장한 후 경기 진행을 시작할 수 있습니다."
          }
          onClick={() => {
            if (hasSchedule) {
              setActiveTab("monitor");
            }
          }}
        >
          <Activity size={18} aria-hidden="true" />
          경기 진행
        </button>
      </nav>
      <div style={{ display: activeTab === "participants" ? "block" : "none" }}>
        <ParticipantManager
          eventRecord={eventRecord}
          hasGameConfiguration={Boolean(gameSetting)}
          onEventUpdated={setEventRecord}
          onGameConfigurationReset={handleGameConfigurationReset}
        />
      </div>
      <div
        style={{ display: activeTab === "game-settings" ? "block" : "none" }}
      >
        <GameSettingsPanel
          key={`settings-${configurationRevision}`}
          eventId={eventId}
          participationStatus={eventRecord.participation_status}
          onSettingChanged={handleSettingChanged}
          onConfigurationReset={handleSettingConfigurationReset}
        />

        <TeamFormationPanel
          key={`formation-${configurationRevision}-${gameSetting?.id ?? "none"}`}
          setting={gameSetting}
          onFormationChanged={setFormationStatus}
          onScheduleReset={handleScheduleReset}
        />
      </div>

      {activeTab === "schedule" &&
        gameSetting?.competition_type === "team_league" && (
          <TeamSchedulePanel
            setting={gameSetting}
            onScheduleChanged={setHasSchedule}
          />
        )}

      {activeTab === "schedule" &&
        gameSetting?.competition_type === "individual_singles" && (
          <IndividualSchedulePanel
            setting={gameSetting}
            onScheduleChanged={setHasSchedule}
          />
        )}

      {activeTab === "monitor" && hasSchedule && (
        <MatchMonitorPanel setting={gameSetting} />
      )}
    </section>
  );
}
