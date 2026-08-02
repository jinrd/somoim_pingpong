import { Archive, CalendarDays, CircleStop, Trash2 } from "lucide-react";

import { EVENT_STATUS_LABELS, type SomoimEvent } from "./types";

import styles from "./Events.module.css";

interface Props {
  eventRecord: SomoimEvent;
  isDeleting: boolean;
  isArchiving: boolean;
  isForceCompleting: boolean;
  onDeleteRequest: () => void;
  onArchiveRequest: () => void;
  onForceCompleteRequest: () => void;
}

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

export default function EventDetailHeader({
  eventRecord,
  isDeleting,
  isArchiving,
  isForceCompleting,
  onDeleteRequest,
  onArchiveRequest,
  onForceCompleteRequest,
}: Props) {
  return (
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
          onClick={onDeleteRequest}
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
          onClick={onArchiveRequest}
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
          onClick={onForceCompleteRequest}
        >
          <CircleStop size={17} aria-hidden="true" />
          회차 강제 종료
        </button>
      )}
    </header>
  );
}
