import { useState, useEffect } from "react";
import { Copy, Link2, Link2Off, RefreshCw } from "lucide-react";
import { ClientResponseError } from "pocketbase";

import {
  disablePublicEventLink,
  getEvent,
  issuePublicEventLink,
  getAdminPublicEventLink,
} from "./api";

import type { SomoimEvent } from "./types";

import styles from "./Events.module.css";

interface Props {
  eventRecord: SomoimEvent;
  onEventUpdated: (updatedEvent: SomoimEvent) => void;
}

const toDateTimeLocalValue = (value?: string): string => {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (number: number): string => String(number).padStart(2, "0");

  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
};

const getInitialExpiration = (eventRecord: SomoimEvent): string => {
  if (eventRecord.public_expires_at) {
    return toDateTimeLocalValue(eventRecord.public_expires_at);
  }

  const eventDate = eventRecord.event_date.slice(0, 10);

  return `${eventDate}T23:59`;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof ClientResponseError) {
    return error.response.message || "참석 링크 요청을 처리하지 못했습니다.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "참석 링크 요청을 처리하지 못했습니다.";
};

export default function PublicLinkManager({
  eventRecord,
  onEventUpdated,
}: Props) {
  const [expiration, setExpiration] = useState(() =>
    getInitialExpiration(eventRecord),
  );

  const [issuedLink, setIssuedLink] = useState("");

  const [isWorking, setIsWorking] = useState(false);

  const [message, setMessage] = useState("");

  const [error, setError] = useState("");

  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const [isRecoverable, setIsRecoverable] = useState(true);

  useEffect(() => {
    let cancelled = false;

    getAdminPublicEventLink(eventRecord.id)
      .then((result) => {
        if (cancelled) {
          return;
        }

        setIsRecoverable(result.recoverable);

        if (result.enabled && result.recoverable && result.token) {
          const restoredLink =
            `${window.location.origin}` + `/join/events/${result.token}`;

          setIssuedLink(restoredLink);
          setExpiration(toDateTimeLocalValue(result.expiresAt));
        } else {
          setIssuedLink("");
        }
      })
      .catch((caughtError) => {
        if (!cancelled) {
          setError(getErrorMessage(caughtError));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsInitialLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [eventRecord.id, eventRecord.public_access_enabled]);

  const isEnabled = eventRecord.public_access_enabled;

  const handleIssue = async () => {
    if (!expiration) {
      setError("링크 만료 시간을 선택해 주세요.");
      return;
    }

    const expiresAt = new Date(expiration);

    if (
      Number.isNaN(expiresAt.getTime()) ||
      expiresAt.getTime() <= Date.now()
    ) {
      setError("링크 만료 시간은 현재 이후여야 합니다.");
      return;
    }

    if (
      isEnabled &&
      !window.confirm(
        "기존 참석 링크는 사용할 수 없게 됩니다. 새 링크를 발급할까요?",
      )
    ) {
      return;
    }

    setIsWorking(true);
    setError("");
    setMessage("");

    try {
      const result = await issuePublicEventLink(
        eventRecord.id,
        expiresAt.toISOString(),
      );

      const publicLink =
        `${window.location.origin}` + `/join/events/${result.token}`;

      const updatedEvent = await getEvent(eventRecord.id);

      setIssuedLink(publicLink);
      setIsRecoverable(true);
      setExpiration(toDateTimeLocalValue(result.expiresAt));

      setMessage(
        "새 링크가 발급됐습니다. 페이지를 벗어나기 전에 복사해 주세요.",
      );

      onEventUpdated(updatedEvent);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setIsWorking(false);
    }
  };

  const handleCopy = async () => {
    if (!issuedLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(issuedLink);

      setError("");
      setMessage("참석 링크를 복사했습니다.");
    } catch {
      setError("자동 복사하지 못했습니다. 링크 입력란에서 직접 복사해 주세요.");
    }
  };

  const handleDisable = async () => {
    if (!window.confirm("현재 참석 링크를 비활성화할까요?")) {
      return;
    }

    setIsWorking(true);
    setError("");
    setMessage("");

    try {
      await disablePublicEventLink(eventRecord.id);

      const updatedEvent = await getEvent(eventRecord.id);

      setIssuedLink("");
      setIsRecoverable(false);
      setMessage("참석 링크를 비활성화했습니다.");

      onEventUpdated(updatedEvent);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <section className={styles.publicLinkPanel}>
      <div className={styles.publicLinkHeader}>
        <div>
          <h2>참석 링크</h2>

          <p>참가자가 링크로 접속해 본인 확인 후 참석 여부를 선택합니다.</p>
        </div>

        <span
          className={
            isEnabled ? styles.publicLinkEnabled : styles.publicLinkDisabled
          }
        >
          {isEnabled ? "사용 중" : "비활성"}
        </span>
      </div>

      <div className={styles.publicLinkControls}>
        <label>
          <span>링크 만료 시간</span>

          <input
            type="datetime-local"
            className={styles.input}
            value={expiration}
            disabled={isWorking}
            onChange={(event) => {
              setExpiration(event.target.value);
            }}
          />
        </label>

        <div className={styles.publicLinkActions}>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={isWorking}
            onClick={() => {
              void handleIssue();
            }}
          >
            {isEnabled ? (
              <RefreshCw size={18} aria-hidden="true" />
            ) : (
              <Link2 size={18} aria-hidden="true" />
            )}

            {isWorking
              ? "처리 중…"
              : isEnabled
                ? "새 링크 재발급"
                : "참석 링크 만들기"}
          </button>

          {isEnabled && (
            <button
              type="button"
              className={styles.dangerButton}
              disabled={isWorking}
              onClick={() => {
                void handleDisable();
              }}
            >
              <Link2Off size={18} aria-hidden="true" />
              비활성화
            </button>
          )}
        </div>
      </div>

      {isInitialLoading && (
        <p className={styles.publicLinkHint}>
          기존 참석 링크를 불러오는 중입니다…
        </p>
      )}

      {!isInitialLoading && isEnabled && !issuedLink && !isRecoverable && (
        <p className={styles.publicLinkHint}>
          이 링크는 암호화 저장 기능이 추가되기 전에 발급되어 원본을 복원할 수
          없습니다. 새 링크를 한 번 재발급해 주세요.
        </p>
      )}

      {issuedLink && (
        <div className={styles.issuedLinkBox}>
          <label htmlFor="issued-public-link">새로 발급된 참석 링크</label>

          <div>
            <input
              id="issued-public-link"
              type="text"
              value={issuedLink}
              readOnly
              onFocus={(event) => {
                event.currentTarget.select();
              }}
            />

            <button
              type="button"
              className={styles.copyButton}
              onClick={() => {
                void handleCopy();
              }}
            >
              <Copy size={18} aria-hidden="true" />
              복사
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className={styles.publicLinkSuccess} role="status">
          {message}
        </p>
      )}

      {error && (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
