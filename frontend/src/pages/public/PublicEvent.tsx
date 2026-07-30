import { useCallback, useEffect, useState } from "react";

import {
  AlertCircle,
  BellRing,
  CalendarDays,
  ChevronRight,
  LoaderCircle,
  Trophy,
  UserCheck,
} from "lucide-react";

import { ClientResponseError } from "pocketbase";

import { useParams } from "react-router-dom";

import { getPublicEvent } from "../../features/events/api";

import PublicIdentityForm from "../../features/events/PublicIdentityForm";
import PublicParticipationForm from "../../features/events/PublicParticipationForm";
import PublicTeamLineupSection from "../../features/lineup/PublicTeamLineupSection";
import PublicIndividualLineupSection, {
  type PublicIndividualMatchStartedNotice,
} from "../../features/lineup/PublicIndividualLineupSection";
import {
  EVENT_STATUS_LABELS,
  type PublicEventResponse,
  type PublicIdentityResult,
  type PublicIdentifiedParticipant,
} from "../../features/events/types";
import LeagueStandingsPanel from "../../features/standings/LeagueStandingsPanel";
import styles from "./PublicEvent.module.css";

const formatDate = (value: string): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
};

const formatExpiration = (value: string): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const getPublicErrorMessage = (error: unknown): string => {
  if (error instanceof ClientResponseError) {
    if (error.status === 404) {
      return (
        error.response.message || "유효하지 않거나 만료된 참석 링크입니다."
      );
    }

    return error.response.message || "회차 정보를 불러오지 못했습니다.";
  }

  return "서버에 연결하지 못했습니다.";
};

const getStoredIdentity = (
  publicToken?: string,
): PublicIdentityResult | null => {
  if (!publicToken) {
    return null;
  }

  try {
    const storedValue = sessionStorage.getItem(
      `event-participant:${publicToken}`,
    );

    if (!storedValue) {
      return null;
    }

    const parsedValue = JSON.parse(storedValue) as PublicIdentityResult;

    if (
      !parsedValue.responseToken ||
      !parsedValue.participant ||
      !parsedValue.competitionType
    ) {
      return null;
    }

    return parsedValue;
  } catch {
    return null;
  }
};

export default function PublicEvent() {
  const { token } = useParams<{
    token: string;
  }>();

  const [response, setResponse] = useState<PublicEventResponse | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const [error, setError] = useState("");

  const [identity, setIdentity] = useState<PublicIdentityResult | null>(() =>
    getStoredIdentity(token),
  );
  const [activePublicTab, setActivePublicTab] = useState<"mine" | "live">(
    "mine",
  );
  const [matchStartNotice, setMatchStartNotice] =
    useState<PublicIndividualMatchStartedNotice | null>(null);

  const handleIndividualMatchStarted = useCallback(
    (notice: PublicIndividualMatchStartedNotice) => {
      setMatchStartNotice(notice);
    },
    [],
  );

  const openMyMatch = () => {
    setActivePublicTab("mine");
    setMatchStartNotice(null);

    window.requestAnimationFrame(() => {
      document.getElementById("public-panel-mine")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const loadEvent = () => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    setError("");

    getPublicEvent(token)
      .then((result) => {
        setResponse(result);
      })
      .catch((caughtError) => {
        setError(getPublicErrorMessage(caughtError));
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
          setError(getPublicErrorMessage(caughtError));
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
              <AlertCircle size={28} aria-hidden="true" />
            </span>

            <h1>잘못된 참석 주소입니다.</h1>

            <p>운영진에게 올바른 참석 링크를 다시 요청해 주세요.</p>
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
              <LoaderCircle size={28} aria-hidden="true" />
            </span>

            <h1>회차를 확인하고 있습니다.</h1>

            <p>잠시만 기다려 주세요.</p>
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
              <AlertCircle size={28} aria-hidden="true" />
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
            <Trophy size={20} aria-hidden="true" />
          </span>
          탁꾸러기 메이트 (Tak-kkoorugi Mate)
        </div>

        <article className={styles.card}>
          <header className={styles.cardHeader}>
            <span className={styles.status}>
              {EVENT_STATUS_LABELS[event.status]}
            </span>

            <h1 className={styles.title}>{event.title}</h1>

            <p className={styles.date}>
              <CalendarDays size={19} aria-hidden="true" />

              <time dateTime={event.eventDate}>
                {formatDate(event.eventDate)}
              </time>
            </p>
          </header>

          <div className={styles.cardBody}>
            <section className={styles.notice}>
              <h2>모임 안내</h2>

              <p>{event.notice || "등록된 공지사항이 없습니다."}</p>
            </section>

            <section className={styles.responseSection}>
              {!identity ? (
                <PublicIdentityForm
                  publicToken={token}
                  onIdentified={(result) => {
                    setIdentity(result);
                  }}
                />
              ) : (
                <div className={styles.identifiedContent}>
                  <div className={styles.identitySuccess}>
                    <span className={styles.successIcon}>
                      <UserCheck size={24} aria-hidden="true" />
                    </span>

                    <div>
                      <h2>{identity.participant.displayName}님</h2>

                      <p>본인 확인 완료 · {identity.participant.rank}부</p>
                    </div>
                  </div>
                  <div
                    className={styles.publicTabs}
                    role="tablist"
                    aria-label="참가자 경기 메뉴"
                  >
                    <button
                      type="button"
                      role="tab"
                      id="public-tab-mine"
                      aria-controls="public-panel-mine"
                      aria-selected={activePublicTab === "mine"}
                      className={
                        activePublicTab === "mine"
                          ? styles.publicTabActive
                          : styles.publicTab
                      }
                      onClick={() => setActivePublicTab("mine")}
                    >
                      내 경기
                    </button>

                    <button
                      type="button"
                      role="tab"
                      id="public-tab-live"
                      aria-controls="public-panel-live"
                      aria-selected={activePublicTab === "live"}
                      className={
                        activePublicTab === "live"
                          ? styles.publicTabActive
                          : styles.publicTab
                      }
                      onClick={() => setActivePublicTab("live")}
                    >
                      경기 현황
                    </button>
                  </div>

                  {matchStartNotice && (
                    <button
                      type="button"
                      className={styles.matchStartNotice}
                      onClick={openMyMatch}
                    >
                      <span className={styles.matchStartNoticeIcon}>
                        <BellRing size={20} aria-hidden="true" />
                      </span>
                      <span className={styles.matchStartNoticeText}>
                        <strong>
                          {matchStartNotice.tableNumber}번 테이블 경기 시작
                        </strong>
                        <small>
                          {matchStartNotice.opponentName}님과 경기할 차례입니다.
                        </small>
                      </span>
                      <ChevronRight size={19} aria-hidden="true" />
                    </button>
                  )}

                  <div
                    id="public-panel-mine"
                    className={styles.publicTabPanel}
                    role="tabpanel"
                    aria-labelledby="public-tab-mine"
                    hidden={activePublicTab !== "mine"}
                  >
                    {event.participationStatus === "open" &&
                    !identity.participant.hasResponded ? (
                      <PublicParticipationForm
                        responseToken={identity.responseToken}
                        participant={identity.participant}
                        onUpdated={(
                          updatedParticipant: PublicIdentifiedParticipant,
                        ) => {
                          const updatedIdentity = {
                            ...identity,
                            participant: updatedParticipant,
                          };

                          setIdentity(updatedIdentity);

                          sessionStorage.setItem(
                            `event-participant:${token}`,
                            JSON.stringify(updatedIdentity),
                          );
                        }}
                      />
                    ) : (
                      <div className={styles.lockedNotice}>
                        <strong>
                          {event.participationStatus === "closed"
                            ? "참가 신청 마감"
                            : "참가 신청 완료"}
                        </strong>
                        <p>변경은 운영진에게 문의해 주세요.</p>
                      </div>
                    )}

                    {identity.participant.gameParticipationStatus ===
                      "playing" &&
                      identity.competitionType === "team_league" && (
                        <PublicTeamLineupSection
                          responseToken={identity.responseToken}
                        />
                      )}

                    {identity.participant.gameParticipationStatus ===
                      "playing" &&
                      identity.competitionType === "individual_singles" && (
                        <PublicIndividualLineupSection
                          responseToken={identity.responseToken}
                          onMatchStarted={handleIndividualMatchStarted}
                        />
                      )}
                  </div>

                  {activePublicTab === "live" && (
                    <div
                      id="public-panel-live"
                      className={styles.publicTabPanel}
                      role="tabpanel"
                      aria-labelledby="public-tab-live"
                    >
                      <LeagueStandingsPanel
                        responseToken={identity.responseToken}
                      />
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        </article>

        <p className={styles.expiration}>
          이 참석 링크는 {formatExpiration(expiresAt)}
          까지 사용할 수 있습니다.
        </p>
      </div>
    </main>
  );
}
