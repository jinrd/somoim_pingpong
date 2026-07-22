import { useEffect, useState } from "react";

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

import type { EventGameSetting } from "../../features/game-settings/types";
import ParticipantManager from "../../features/events/ParticipantManager";
import PublicLinkManager from "../../features/events/PublicLinkManager";
import { getEvent } from "../../features/events/api";
import GameSettingsPanel from "../../features/game-settings/GameSettingsPanel";
import {
  EVENT_STATUS_LABELS,
  type SomoimEvent,
} from "../../features/events/types";

import styles from "../../features/events/Events.module.css";

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
    "participants" | "game-settings" | "schedule"
  >("participants");

  const [gameSetting, setGameSetting] = useState<EventGameSetting | null>(null);

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
          onClick={() => {
            setActiveTab("schedule");
          }}
        >
          <ListOrdered size={18} aria-hidden="true" />
          대진표/결과
        </button>
      </nav>

      <div style={{ display: activeTab === "participants" ? "block" : "none" }}>
        <ParticipantManager eventId={eventId} />
      </div>
      <div
        style={{ display: activeTab === "game-settings" ? "block" : "none" }}
      >
        <GameSettingsPanel
          eventId={eventId}
          onSettingChanged={setGameSetting}
        />

        <TeamFormationPanel setting={gameSetting} />
      </div>
      {activeTab === "schedule" && <TeamSchedulePanel setting={gameSetting} />}
    </section>
  );
}
