import {
  useEffect,
  useState,
} from 'react';

import {
  AlertCircle,
  CalendarDays,
  LoaderCircle,
  LogIn,
  Trophy,
} from 'lucide-react';

import { ClientResponseError } from 'pocketbase';

import { useParams } from 'react-router-dom';

import { getPublicEvent } from '../../features/events/api';

import {
  EVENT_STATUS_LABELS,
  type PublicEventResponse,
} from '../../features/events/types';

import styles from './PublicEvent.module.css';

const formatDate = (
  value: string,
): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date);
};

const formatExpiration = (
  value: string,
): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const getPublicErrorMessage = (
  error: unknown,
): string => {
  if (error instanceof ClientResponseError) {
    if (error.status === 404) {
      return (
        error.response.message ||
        '유효하지 않거나 만료된 참석 링크입니다.'
      );
    }

    return (
      error.response.message ||
      '회차 정보를 불러오지 못했습니다.'
    );
  }

  return '서버에 연결하지 못했습니다.';
};

export default function PublicEvent() {
  const { token } = useParams<{
    token: string;
  }>();

  const [response, setResponse] =
    useState<PublicEventResponse | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const loadEvent = () => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    setError('');

    getPublicEvent(token)
      .then((result) => {
        setResponse(result);
      })
      .catch((caughtError) => {
        setError(
          getPublicErrorMessage(caughtError),
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    getPublicEvent(token)
      .then((result) => {
        if (!cancelled) {
          setResponse(result);
        }
      })
      .catch((caughtError) => {
        if (!cancelled) {
          setError(
            getPublicErrorMessage(caughtError),
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
  }, [token]);

  if (!token) {
    return (
      <main className={styles.page}>
        <div className={styles.container}>
          <div className={styles.stateCard}>
            <span className={styles.stateIcon}>
              <AlertCircle
                size={28}
                aria-hidden="true"
              />
            </span>

            <h1>잘못된 참석 주소입니다.</h1>

            <p>
              운영진에게 올바른 참석 링크를
              다시 요청해 주세요.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className={styles.page}>
        <div className={styles.container}>
          <div className={styles.stateCard}>
            <span className={styles.stateIcon}>
              <LoaderCircle
                size={28}
                aria-hidden="true"
              />
            </span>

            <h1>회차를 확인하고 있습니다.</h1>

            <p>
              잠시만 기다려 주세요.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (error || !response) {
    return (
      <main className={styles.page}>
        <div className={styles.container}>
          <div className={styles.stateCard}>
            <span className={styles.stateIcon}>
              <AlertCircle
                size={28}
                aria-hidden="true"
              />
            </span>

            <h1>참석 링크를 사용할 수 없습니다.</h1>

            <p>{error}</p>

            <button
              type="button"
              className={styles.retryButton}
              onClick={loadEvent}
            >
              다시 확인
            </button>
          </div>
        </div>
      </main>
    );
  }

  const { event, expiresAt } = response;

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}>
            <Trophy
              size={20}
              aria-hidden="true"
            />
          </span>

          소모임 탁구 매니저
        </div>

        <article className={styles.card}>
          <header className={styles.cardHeader}>
            <span className={styles.status}>
              {EVENT_STATUS_LABELS[event.status]}
            </span>

            <h1 className={styles.title}>
              {event.title}
            </h1>

            <p className={styles.date}>
              <CalendarDays
                size={19}
                aria-hidden="true"
              />

              <time dateTime={event.eventDate}>
                {formatDate(event.eventDate)}
              </time>
            </p>
          </header>

          <div className={styles.cardBody}>
            <section className={styles.notice}>
              <h2>모임 안내</h2>

              <p>
                {event.notice ||
                  '등록된 공지사항이 없습니다.'}
              </p>
            </section>

            <section className={styles.responseSection}>
              <h2>참석 여부 응답</h2>

              <p>
                다음 단계에서 이름과 연락처를
                이용한 본인 확인 기능이 연결됩니다.
              </p>

              <button
                type="button"
                className={styles.pendingButton}
                disabled
              >
                <LogIn
                  size={18}
                  aria-hidden="true"
                />
                본인 확인 기능 준비 중
              </button>
            </section>
          </div>
        </article>

        <p className={styles.expiration}>
          이 참석 링크는{' '}
          {formatExpiration(expiresAt)}
          까지 사용할 수 있습니다.
        </p>
      </div>
    </main>
  );
}