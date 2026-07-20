import { useState, type SubmitEvent } from 'react';
import { X } from 'lucide-react';

import { createEvent } from './api';
import type {
  EventStatus,
  SomoimEvent,
} from './types';

import styles from './Events.module.css';

interface Props {
  onClose: () => void;
  onCreated: (event: SomoimEvent) => void;
}

const getTodayInputValue = (): string => {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const date = String(today.getDate()).padStart(2, '0');

  return `${year}-${month}-${date}`;
};

const getDefaultTitle = (): string => {
  const today = new Date();

  return `${today.getFullYear()}년 ${
    today.getMonth() + 1
  }월 ${today.getDate()}일 정기모임`;
};

export default function EventFormModal({
  onClose,
  onCreated,
}: Props) {
  const [title, setTitle] = useState(getDefaultTitle);
  const [eventDate, setEventDate] =
    useState(getTodayInputValue);

  const [status, setStatus] =
    useState<EventStatus>('draft');

  const [notice, setNotice] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (
    submitEvent: SubmitEvent<HTMLFormElement>,
  ) => {
    submitEvent.preventDefault();

    setIsSaving(true);
    setError('');

    try {
      const createdEvent = await createEvent({
        title,
        eventDate,
        status,
        notice,
      });

      onCreated(createdEvent);
      onClose();
    } catch (caughtError) {
      if (caughtError instanceof Error) {
        setError(caughtError.message);
      } else {
        setError(
          '회차를 생성하지 못했습니다. 다시 시도해 주세요.',
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-form-title"
        onMouseDown={(mouseEvent) => {
          mouseEvent.stopPropagation();
        }}
      >
        <div className={styles.modalHeader}>
          <h2 id="event-form-title">새 회차 만들기</h2>

          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="회차 생성 창 닫기"
            disabled={isSaving}
          >
            <X size={24} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <p className={styles.formError} role="alert">
              {error}
            </p>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="event-title">
              회차 제목 <span aria-hidden="true">*</span>
            </label>

            <input
              id="event-title"
              type="text"
              className={styles.input}
              value={title}
              onChange={(changeEvent) => {
                setTitle(changeEvent.target.value);
              }}
              maxLength={150}
              required
              autoFocus
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="event-date">
              모임 날짜 <span aria-hidden="true">*</span>
            </label>

            <input
              id="event-date"
              type="date"
              className={styles.input}
              value={eventDate}
              onChange={(changeEvent) => {
                setEventDate(changeEvent.target.value);
              }}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="event-status">초기 상태</label>

            <select
              id="event-status"
              className={styles.input}
              value={status}
              onChange={(changeEvent) => {
                setStatus(
                  changeEvent.target.value as EventStatus,
                );
              }}
            >
              <option value="draft">준비 중</option>
              <option value="active">진행 중</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="event-notice">공지사항</label>

            <textarea
              id="event-notice"
              className={`${styles.input} ${styles.textarea}`}
              value={notice}
              onChange={(changeEvent) => {
                setNotice(changeEvent.target.value);
              }}
              maxLength={3000}
              placeholder="참가자에게 전달할 공지사항을 입력하세요."
            />
          </div>

          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
              disabled={isSaving}
            >
              취소
            </button>

            <button
              type="submit"
              className={styles.primaryButton}
              disabled={isSaving}
            >
              {isSaving ? '생성 중…' : '회차 만들기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}