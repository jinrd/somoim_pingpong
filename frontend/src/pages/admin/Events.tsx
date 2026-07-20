import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  ChevronRight,
  Plus,
  RefreshCw,
} from 'lucide-react';

import EventFormModal from '../../features/events/EventFormModal';
import { getEvents } from '../../features/events/api';

import {
  EVENT_STATUS_LABELS,
  type EventStatus,
  type SomoimEvent,
} from '../../features/events/types';

import styles from '../../features/events/Events.module.css';

const formatEventDate = (eventDate: string): string => {
  const parsedDate = new Date(eventDate);

  if (Number.isNaN(parsedDate.getTime())) {
    return eventDate;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(parsedDate);
};

const compareEvents = (
  firstEvent: SomoimEvent,
  secondEvent: SomoimEvent,
): number => {
  return (
    new Date(secondEvent.event_date).getTime() -
    new Date(firstEvent.event_date).getTime()
  );
};

const getStatusClassName = (
  status: EventStatus,
): string => {
  switch (status) {
    case 'draft':
      return styles.statusDraft;

    case 'active':
      return styles.statusActive;

    case 'completed':
      return styles.statusCompleted;

    case 'archived':
      return styles.statusArchived;
  }
};

export default function Events() {
  const navigate = useNavigate();

  const [events, setEvents] = useState<SomoimEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setCreateModalOpen] =
    useState(false);

  const [error, setError] = useState('');

  const loadEvents = async () => {
    setIsLoading(true);
    setError('');

    try {
      const records = await getEvents();
      setEvents(records);
    } catch {
      setError(
        '회차 목록을 불러오지 못했습니다. 서버 연결과 로그인 상태를 확인해 주세요.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    getEvents()
      .then((records) => {
        if (!cancelled) {
          setEvents(records);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            '회차 목록을 불러오지 못했습니다. 서버 연결과 로그인 상태를 확인해 주세요.',
          );
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
  }, []);

  const handleEventCreated = (
    createdEvent: SomoimEvent,
  ) => {
    setEvents((currentEvents) => {
      return [...currentEvents, createdEvent].sort(
        compareEvents,
      );
    });
  };

  const openEventDetail = (eventId: string) => {
    navigate(`/events/${eventId}`);
  };

  return (
    <section className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>회차 관리</h1>

          <p className={styles.pageDescription}>
            모임 회차를 만들고 참석자와 경기 진행 상태를
            관리합니다.
          </p>
        </div>

        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => {
            setCreateModalOpen(true);
          }}
        >
          <Plus size={18} aria-hidden="true" />
          새 회차 만들기
        </button>
      </div>

      {error && (
        <div className={styles.errorPanel} role="alert">
          <p>{error}</p>

          <button
            type="button"
            className={styles.retryButton}
            onClick={loadEvents}
            disabled={isLoading}
          >
            <RefreshCw
              size={17}
              aria-hidden="true"
            />
            다시 시도
          </button>
        </div>
      )}

      <div className={styles.summary}>
        <CalendarDays size={20} aria-hidden="true" />

        <span>
          총 <strong>{events.length}</strong>개의 회차
        </span>
      </div>

      {isLoading ? (
        <div
          className={styles.emptyPanel}
          aria-live="polite"
        >
          회차 목록을 불러오는 중입니다…
        </div>
      ) : events.length === 0 ? (
        <div className={styles.emptyPanel}>
          <CalendarDays
            size={42}
            aria-hidden="true"
          />

          <h2>아직 생성된 회차가 없습니다.</h2>

          <p>
            새 회차를 만들어 참석자를 관리해 보세요.
          </p>

          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => {
              setCreateModalOpen(true);
            }}
          >
            <Plus size={18} aria-hidden="true" />
            첫 회차 만들기
          </button>
        </div>
      ) : (
        <div className={styles.eventList}>
          {events.map((event) => (
            <article
              key={event.id}
              className={styles.eventCard}
            >
              <button
                type="button"
                className={styles.eventCardButton}
                onClick={() => {
                  openEventDetail(event.id);
                }}
                aria-label={`${event.title} 회차 상세 보기`}
              >
                <div className={styles.eventCardContent}>
                  <div className={styles.eventCardTop}>
                    <span
                      className={`${styles.statusBadge} ${getStatusClassName(
                        event.status,
                      )}`}
                    >
                      {EVENT_STATUS_LABELS[event.status]}
                    </span>

                    <time dateTime={event.event_date}>
                      {formatEventDate(event.event_date)}
                    </time>
                  </div>

                  <h2 className={styles.eventTitle}>
                    {event.title}
                  </h2>

                  <p className={styles.eventNotice}>
                    {event.notice?.trim() ||
                      '등록된 공지사항이 없습니다.'}
                  </p>
                </div>

                <ChevronRight
                  size={22}
                  aria-hidden="true"
                />
              </button>
            </article>
          ))}
        </div>
      )}

      {isCreateModalOpen && (
        <EventFormModal
          onClose={() => {
            setCreateModalOpen(false);
          }}
          onCreated={handleEventCreated}
        />
      )}
    </section>
  );
}