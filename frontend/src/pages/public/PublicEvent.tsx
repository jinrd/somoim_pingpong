import { useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  LoaderCircle,
  Trophy,
  UserCheck,
} from "lucide-react";

import { useParams } from "react-router-dom";

import usePublicEventData from "./usePublicEventData";

import PublicIdentityForm from "../../features/events/PublicIdentityForm";
import PublicParticipationForm from "../../features/events/PublicParticipationForm";
import PublicTeamMatchesSection from "../../features/public-matches/PublicTeamMatchesSection";
import PublicIndividualMatchesSection from "../../features/public-matches/PublicIndividualMatchesSection";
import PublicParticipantSummary from "../../features/public-matches/PublicParticipantSummary";
import {
  EVENT_STATUS_LABELS,
  type PublicIdentifiedParticipant,
} from "../../features/events/types";
import LeagueStandingsPanel from "../../features/standings/LeagueStandingsPanel";
import usePublicIdentity from "./usePublicIdentity";

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

export default function PublicEvent() {
  const { token } = useParams<{
    token: string;
  }>();
  const { response, isLoading, error, reload } = usePublicEventData(token);
  const { identity, setIdentity, updateParticipant, clearIdentity } =
    usePublicIdentity(token);
  const [activePublicTab, setActivePublicTab] = useState<
    "home" | "mine" | "live"
  >("home");

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
              onClick={() => void reload()}
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
                      id="public-tab-home"
                      aria-controls="public-panel-home"
                      aria-selected={activePublicTab === "home"}
                      className={
                        activePublicTab === "home"
                          ? styles.publicTabActive
                          : styles.publicTab
                      }
                      onClick={() => setActivePublicTab("home")}
                    >
                      홈
                    </button>
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


                  <div
                    id="public-panel-home"
                    className={styles.publicTabPanel}
                    role="tabpanel"
                    aria-labelledby="public-tab-home"
                    hidden={activePublicTab !== "home"}
                  >
                    <PublicParticipantSummary
                      participant={identity.participant}
                      competitionType={identity.competitionType}
                    />

                    {event.participationStatus === "open" &&
                    !identity.participant.hasResponded ? (
                      <PublicParticipationForm
                        responseToken={identity.responseToken}
                        participant={identity.participant}
                        onUpdated={(
                          updatedParticipant: PublicIdentifiedParticipant,
                        ) => {
                          updateParticipant(updatedParticipant);
                        }}
                      />
                    ) : (
                      <div className={styles.lockedNotice}>
                        <strong>
                          {event.participationStatus === "closed"
                            ? "참가 신청 마감"
                            : "참가 신청 완료"}
                        </strong>

                        <p>게임 참가 상태는 운영진에게 문의해 주세요.</p>
                      </div>
                    )}

                    <div className={styles.homeGuide}>
                      <strong>경기 확인</strong>
                      <p>
                        {identity.competitionType === "team_league"
                          ? "내 경기 탭에서 팀 정보와 경기 순서를 확인할 수 있습니다."
                          : "내 경기 탭에서 내 경기와 경기 순서를 확인할 수 있습니다."}
                      </p>
                    </div>

                    <button
                      type="button"
                      className={styles.changeIdentityButton}
                      onClick={clearIdentity}
                    >
                      다른 참가자로 확인
                    </button>
                  </div>
                  <div
                    id="public-panel-mine"
                    className={styles.publicTabPanel}
                    role="tabpanel"
                    aria-labelledby="public-tab-mine"
                    hidden={activePublicTab !== "mine"}
                  >
                    {identity.participant.gameParticipationStatus !==
                      "playing" && (
                      <div className={styles.lockedNotice}>
                        <strong>게임 미참가 상태입니다.</strong>
                        <p>
                          현재 경기 정보가 없습니다. 참가 상태를 변경하려면
                          운영진에게 문의해 주세요.
                        </p>
                      </div>
                    )}

                    {identity.participant.gameParticipationStatus ===
                      "playing" &&
                      identity.competitionType === "team_league" && (
                        <PublicTeamMatchesSection
                          responseToken={identity.responseToken}
                          isActive={activePublicTab === "mine"}
                        />
                      )}

                    {identity.participant.gameParticipationStatus ===
                      "playing" &&
                      identity.competitionType === "individual_singles" && (
                        <PublicIndividualMatchesSection
                          responseToken={identity.responseToken}
                          isActive={activePublicTab === "mine"}
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
