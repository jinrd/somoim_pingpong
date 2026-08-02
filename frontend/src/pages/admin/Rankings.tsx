import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  History,
  LoaderCircle,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trophy,
  X,
} from "lucide-react";
import { ClientResponseError } from "pocketbase";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  approveRankingCandidate,
  getMemberRankingDetail,
  type MemberRankingDetail,
  type RankingCandidate,
  type RankingDirection,
  type RankingOverview,
  recalculateRankings,
  rejectRankingCandidate,
  updateMemberRank,
} from "../../features/rankings/api";

import styles from "./Rankings.module.css";

type RankingTab = "members" | "candidates";

interface ReviewTarget {
  candidate: RankingCandidate;
  action: "approve" | "reject";
}

const formatDateTime = (value: string): string => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof ClientResponseError) {
    return error.response.message || fallback;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

const getDirectionLabel = (direction: RankingDirection): string => {
  return direction === "promotion" ? "승급" : "강등";
};

export default function Rankings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [overview, setOverview] = useState<RankingOverview | null>(null);
  const [selectedDetail, setSelectedDetail] =
    useState<MemberRankingDetail | null>(null);
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<RankingTab>("members");
  const [isRankEditing, setIsRankEditing] = useState(false);
  const [rankInput, setRankInput] = useState(0);
  const [isRankSaving, setIsRankSaving] = useState(false);

  const selectedMemberId = searchParams.get("member") ?? "";

  const loadOverview = useCallback(async () => {
    setError("");

    try {
      const result = await recalculateRankings();

      setOverview(result);
    } catch (caughtError) {
      setError(
        getErrorMessage(caughtError, "부수 관리 정보를 불러오지 못했습니다."),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const openMemberDetail = useCallback(
    async (memberId: string) => {
      setIsDetailLoading(true);
      setError("");
      setSearchParams({ member: memberId });

      try {
        const result = await getMemberRankingDetail(memberId);

        setSelectedDetail(result);
        setRankInput(result.member.currentRank);
        setIsRankEditing(false);
      } catch (caughtError) {
        setError(
          getErrorMessage(caughtError, "회원 전적을 불러오지 못했습니다."),
        );
      } finally {
        setIsDetailLoading(false);
      }
    },
    [setSearchParams],
  );

  const closeMemberDetail = () => {
    setSelectedDetail(null);
    setSearchParams({});
  };

  const handleSaveMemberRank = async () => {
    if (!selectedDetail || !overview) {
      return;
    }

    const { minRank, maxRank } = overview.settings;

    if (
      !Number.isInteger(rankInput) ||
      rankInput < minRank ||
      rankInput > maxRank
    ) {
      setError(`${minRank}부부터 ${maxRank}부 사이로 입력해 주세요.`);
      return;
    }

    if (rankInput === selectedDetail.member.currentRank) {
      setIsRankEditing(false);
      return;
    }

    setIsRankSaving(true);
    setError("");
    setMessage("");

    try {
      const memberId = selectedDetail.member.memberId;

      await updateMemberRank(memberId, {
        rank: rankInput,
      });

      const [nextOverview, nextDetail] = await Promise.all([
        recalculateRankings(),
        getMemberRankingDetail(memberId),
      ]);

      setOverview(nextOverview);
      setSelectedDetail(nextDetail);
      setRankInput(nextDetail.member.currentRank);
      setIsRankEditing(false);
      setMessage(
        `${nextDetail.member.nickname}님의 부수를 ${nextDetail.member.currentRank}부로 변경했습니다.`,
      );
    } catch (caughtError) {
      setError(
        getErrorMessage(caughtError, "회원 부수를 변경하지 못했습니다."),
      );
    } finally {
      setIsRankSaving(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    recalculateRankings()
      .then((result) => {
        if (!cancelled) {
          setOverview(result);
        }
      })
      .catch((caughtError) => {
        if (!cancelled) {
          setError(
            getErrorMessage(
              caughtError,
              "부수 관리 정보를 불러오지 못했습니다.",
            ),
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

  useEffect(() => {
    if (
      !selectedMemberId ||
      selectedDetail?.member.memberId === selectedMemberId
    ) {
      return;
    }

    let cancelled = false;

    getMemberRankingDetail(selectedMemberId)
      .then((result) => {
        if (!cancelled) {
          setSelectedDetail(result);
        }
      })
      .catch((caughtError) => {
        if (!cancelled) {
          setError(
            getErrorMessage(caughtError, "회원 전적을 불러오지 못했습니다."),
          );
          setSearchParams({});
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsDetailLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDetail?.member.memberId, selectedMemberId, setSearchParams]);

  const activeMemberCount = useMemo(
    () =>
      overview?.members.filter((member) => member.status === "active").length ??
      0,
    [overview],
  );

  const beginReview = (
    candidate: RankingCandidate,
    action: ReviewTarget["action"],
  ) => {
    setReviewTarget({ candidate, action });
    setReviewNote("");
    setError("");
    setMessage("");
  };

  const submitReview = async () => {
    if (!reviewTarget) {
      return;
    }

    setIsReviewing(true);
    setError("");

    try {
      const input = {
        expectedVersion: reviewTarget.candidate.version,
        note: reviewNote.trim(),
      };

      const detail =
        reviewTarget.action === "approve"
          ? await approveRankingCandidate(reviewTarget.candidate.id, input)
          : await rejectRankingCandidate(reviewTarget.candidate.id, input);

      setMessage(
        reviewTarget.action === "approve"
          ? `${reviewTarget.candidate.memberNickname}님의 ${getDirectionLabel(
              reviewTarget.candidate.direction,
            )}을 반영했습니다.`
          : `${reviewTarget.candidate.memberNickname}님의 후보를 반려했습니다.`,
      );
      setReviewTarget(null);
      setReviewNote("");

      await loadOverview();

      if (selectedDetail?.member.memberId === detail.member.memberId) {
        setSelectedDetail(detail);
      }
    } catch (caughtError) {
      setError(
        getErrorMessage(caughtError, "승급·강등 후보를 처리하지 못했습니다."),
      );
    } finally {
      setIsReviewing(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.pageHeader}>
        <div className={styles.pageTitle}>
          <div className={styles.titleRow}>
            <span className={styles.pageIcon} aria-hidden="true">
              <Trophy size={22} />
            </span>
            <div>
              <span className={styles.eyebrow}>운영 관리</span>
              <h1>부수 관리</h1>
            </div>
          </div>
          <p>회원별 부수와 승급·강등을 관리합니다.</p>
        </div>

        {activeTab === "candidates" && (
          <button
            type="button"
            className={styles.refreshButton}
            disabled={isLoading}
            onClick={() => {
              setIsLoading(true);
              setMessage("");
              void loadOverview();
            }}
          >
            <RefreshCw
              size={17}
              className={isLoading ? styles.spinner : undefined}
              aria-hidden="true"
            />
            후보 다시 계산
          </button>
        )}
      </header>

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className={styles.success} role="status">
          <Check size={17} aria-hidden="true" />
          {message}
        </div>
      )}
      <nav className={styles.tabList} aria-label="부수 관리 화면">
        <button
          type="button"
          className={
            activeTab === "members" ? styles.tabActive : styles.tabButton
          }
          aria-pressed={activeTab === "members"}
          onClick={() => setActiveTab("members")}
        >
          회원 부수
        </button>

        <button
          type="button"
          className={
            activeTab === "candidates" ? styles.tabActive : styles.tabButton
          }
          aria-pressed={activeTab === "candidates"}
          onClick={() => setActiveTab("candidates")}
        >
          승강 후보
          {(overview?.pendingCandidateCount ?? 0) > 0 && (
            <span className={styles.tabCount}>
              {overview?.pendingCandidateCount}
            </span>
          )}
        </button>
      </nav>
      {activeTab === "candidates" && (
        <>
          <section className={styles.ruleNotice}>
            <ShieldCheck size={22} aria-hidden="true" />
            <div>
              <strong>자동 계산, 운영자 승인 방식</strong>
              <p>
                동일·상위 부수 상대 {overview?.settings.promotionThreshold ?? 3}
                연승은 1단계 승급, 동일·하위 부수 상대{" "}
                {overview?.settings.demotionThreshold ?? 4}연패는 1단계 강등
                후보가 됩니다.
              </p>
            </div>
          </section>

          <section className={styles.summaryGrid} aria-label="부수 관리 요약">
            <article>
              <span>공식 단식</span>
              <strong>{overview?.officialMatchCount ?? 0}</strong>
            </article>
            <article>
              <span>검토 대기</span>
              <strong>{overview?.pendingCandidateCount ?? 0}</strong>
            </article>
            <article>
              <span>활동 회원</span>
              <strong>{activeMemberCount}</strong>
            </article>
          </section>

          <section className={styles.section}>
            <header className={styles.sectionHeader}>
              <div>
                <h2>승급·강등 후보</h2>
                <p>승인해야 실제 회원 부수가 변경됩니다.</p>
              </div>
              <span>{overview?.pendingCandidates.length ?? 0}명</span>
            </header>

            {isLoading ? (
              <div className={styles.loadingState}>
                <LoaderCircle
                  size={24}
                  className={styles.spinner}
                  aria-hidden="true"
                />
                후보를 계산하고 있습니다.
              </div>
            ) : !overview || overview.pendingCandidates.length === 0 ? (
              <div className={styles.emptyState}>
                현재 검토할 승급·강등 후보가 없습니다.
              </div>
            ) : (
              <div className={styles.candidateList}>
                {overview.pendingCandidates.map((candidate) => {
                  const isPromotion = candidate.direction === "promotion";

                  return (
                    <article
                      key={candidate.id}
                      className={
                        isPromotion ? styles.promotionCard : styles.demotionCard
                      }
                    >
                      <span className={styles.directionIcon}>
                        {isPromotion ? (
                          <ArrowUp size={20} aria-hidden="true" />
                        ) : (
                          <ArrowDown size={20} aria-hidden="true" />
                        )}
                      </span>

                      <div className={styles.candidateIdentity}>
                        <strong>{candidate.memberNickname}</strong>
                        <span>{candidate.memberName}</span>
                      </div>

                      <div className={styles.rankChange}>
                        <span>{candidate.currentRank}부</span>
                        <ChevronRight size={16} aria-hidden="true" />
                        <strong>{candidate.proposedRank}부</strong>
                      </div>

                      <div className={styles.streakBadge}>
                        {isPromotion ? "상위 상대" : "하위 상대"}{" "}
                        {candidate.streakCount}
                        {isPromotion ? "연승" : "연패"}
                      </div>

                      <div className={styles.candidateActions}>
                        <button
                          type="button"
                          className={styles.rejectButton}
                          onClick={() => beginReview(candidate, "reject")}
                        >
                          반려
                        </button>
                        <button
                          type="button"
                          className={styles.approveButton}
                          onClick={() => beginReview(candidate, "approve")}
                        >
                          승인
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {activeTab === "members" && (
        <section className={styles.section}>
          <header className={styles.sectionHeader}>
            <div>
              <h2>회원별 부수</h2>
              <p>회원을 선택하면 현재 부수와 상세 기록을 확인할 수 있습니다.</p>
            </div>
            <span>{overview?.members.length ?? 0}명</span>
          </header>

          {isLoading ? (
            <div className={styles.loadingState}>회원 전적을 불러오는 중…</div>
          ) : (
            <div className={styles.memberList}>
              {overview?.members.map((member) => (
                <button
                  key={member.memberId}
                  type="button"
                  className={styles.memberRow}
                  onClick={() => {
                    void openMemberDetail(member.memberId);
                  }}
                >
                  <span className={styles.memberRank}>
                    {member.currentRank}부
                  </span>
                  <span className={styles.memberIdentity}>
                    <strong>{member.nickname}</strong>
                    <small>{member.name}</small>
                  </span>
                  <span className={styles.record}>
                    <strong>
                      {member.wins}승 {member.losses}패
                    </strong>
                    <small>{member.officialMatchCount}경기</small>
                  </span>
                  <span className={styles.streaks}>
                    {member.promotionStreak > 0 && (
                      <small className={styles.promotionText}>
                        승급 {member.promotionStreak}
                      </small>
                    )}
                    {member.demotionStreak > 0 && (
                      <small className={styles.demotionText}>
                        강등 {member.demotionStreak}
                      </small>
                    )}
                    {member.promotionStreak === 0 &&
                      member.demotionStreak === 0 && (
                        <small>연속 기록 없음</small>
                      )}
                  </span>
                  {member.pendingCandidate && (
                    <span className={styles.pendingBadge}>검토 대기</span>
                  )}
                  <ChevronRight
                    className={styles.rowChevron}
                    size={18}
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {isDetailLoading && !selectedDetail && (
        <div className={styles.detailLoading} role="status">
          <LoaderCircle
            size={26}
            className={styles.spinner}
            aria-hidden="true"
          />
          회원 전적을 불러오는 중…
        </div>
      )}

      {selectedDetail && (
        <div
          className={styles.overlay}
          role="presentation"
          onMouseDown={closeMemberDetail}
        >
          <aside
            className={styles.detailPanel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ranking-detail-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className={styles.detailHeader}>
              <div>
                <span>{selectedDetail.member.currentRank}부</span>
                <h2 id="ranking-detail-title">
                  {selectedDetail.member.nickname}
                </h2>
                <p>{selectedDetail.member.name}</p>
              </div>
              <button
                type="button"
                onClick={closeMemberDetail}
                aria-label="회원 전적 닫기"
              >
                <X size={21} aria-hidden="true" />
              </button>
            </header>

            <div className={styles.detailBody}>
              <section className={styles.rankControl}>
                <div>
                  <span>현재 부수</span>
                  <strong>{selectedDetail.member.currentRank}부</strong>
                </div>

                {isRankEditing ? (
                  <div className={styles.rankEditor}>
                    <button
                      type="button"
                      aria-label="부수 숫자 줄이기"
                      disabled={
                        isRankSaving ||
                        rankInput <= (overview?.settings.minRank ?? 0)
                      }
                      onClick={() => setRankInput((current) => current - 1)}
                    >
                      <Minus size={17} aria-hidden="true" />
                    </button>

                    <label>
                      <span className={styles.srOnly}>변경할 부수</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={overview?.settings.minRank}
                        max={overview?.settings.maxRank}
                        value={rankInput}
                        disabled={isRankSaving}
                        onChange={(event) =>
                          setRankInput(Number(event.target.value))
                        }
                      />
                      <strong>부</strong>
                    </label>

                    <button
                      type="button"
                      aria-label="부수 숫자 늘리기"
                      disabled={
                        isRankSaving ||
                        rankInput >= (overview?.settings.maxRank ?? rankInput)
                      }
                      onClick={() => setRankInput((current) => current + 1)}
                    >
                      <Plus size={17} aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      className={styles.rankCancelButton}
                      disabled={isRankSaving}
                      onClick={() => {
                        setRankInput(selectedDetail.member.currentRank);
                        setIsRankEditing(false);
                      }}
                    >
                      취소
                    </button>

                    <button
                      type="button"
                      className={styles.rankSaveButton}
                      disabled={isRankSaving}
                      onClick={() => void handleSaveMemberRank()}
                    >
                      {isRankSaving ? "저장 중" : "저장"}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={styles.rankEditButton}
                    onClick={() => setIsRankEditing(true)}
                  >
                    <Pencil size={16} aria-hidden="true" />
                    부수 수정
                  </button>
                )}
              </section>

              <div className={styles.detailSummary}>
                <article>
                  <span>공식 전적</span>
                  <strong>
                    {selectedDetail.member.wins}승{" "}
                    {selectedDetail.member.losses}패
                  </strong>
                </article>
                <article>
                  <span>승급 연속 기록</span>
                  <strong>{selectedDetail.member.promotionStreak}</strong>
                </article>
                <article>
                  <span>강등 연속 기록</span>
                  <strong>{selectedDetail.member.demotionStreak}</strong>
                </article>
              </div>

              <section className={styles.detailSection}>
                <h3>
                  <Trophy size={17} aria-hidden="true" />
                  공식 단식 기록
                </h3>

                {selectedDetail.matches.length === 0 ? (
                  <p className={styles.detailEmpty}>
                    집계된 공식 단식 경기가 없습니다.
                  </p>
                ) : (
                  <div className={styles.matchHistory}>
                    {selectedDetail.matches.map((match) => (
                      <article key={`${match.sourceType}:${match.id}`}>
                        <span
                          className={
                            match.outcome === "win"
                              ? styles.winBadge
                              : styles.lossBadge
                          }
                        >
                          {match.outcome === "win" ? "승" : "패"}
                        </span>
                        <div>
                          <strong>vs {match.opponentName}</strong>
                          <small>
                            {match.eventTitle} ·{" "}
                            {formatDateTime(match.confirmedAt)}
                          </small>
                          <small>
                            당시 {match.ownRank}부 vs {match.opponentRank}부
                          </small>
                        </div>
                        <span className={styles.matchScore}>
                          {match.ownScore} : {match.opponentScore}
                        </span>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className={styles.detailSection}>
                <h3>
                  <History size={17} aria-hidden="true" />
                  부수 변경 이력
                </h3>

                {selectedDetail.rankHistory.length === 0 ? (
                  <p className={styles.detailEmpty}>
                    저장된 부수 변경 이력이 없습니다.
                  </p>
                ) : (
                  <div className={styles.rankHistory}>
                    {selectedDetail.rankHistory.map((history) => (
                      <article key={history.id}>
                        <div>
                          <strong>
                            {history.previousRank}부 → {history.newRank}부
                          </strong>
                          <small>{history.reason}</small>
                        </div>
                        <span>{formatDateTime(history.effectiveAt)}</span>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </aside>
        </div>
      )}

      {reviewTarget && (
        <div
          className={styles.overlay}
          role="presentation"
          onMouseDown={() => {
            if (!isReviewing) {
              setReviewTarget(null);
            }
          }}
        >
          <div
            className={styles.reviewDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ranking-review-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>
                  {reviewTarget.action === "approve"
                    ? "최종 확인"
                    : "후보 반려"}
                </span>
                <h2 id="ranking-review-title">
                  {reviewTarget.candidate.memberNickname}님{" "}
                  {getDirectionLabel(reviewTarget.candidate.direction)}
                </h2>
              </div>
              <button
                type="button"
                disabled={isReviewing}
                onClick={() => setReviewTarget(null)}
                aria-label="검토 창 닫기"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </header>

            <div className={styles.reviewRank}>
              <strong>{reviewTarget.candidate.currentRank}부</strong>
              <ChevronRight size={18} aria-hidden="true" />
              <strong>{reviewTarget.candidate.proposedRank}부</strong>
            </div>

            <label className={styles.noteField}>
              <span>검토 메모 (선택)</span>
              <textarea
                maxLength={500}
                value={reviewNote}
                placeholder="승인 또는 반려 사유를 남길 수 있습니다."
                onChange={(event) => setReviewNote(event.target.value)}
              />
            </label>

            <div className={styles.reviewActions}>
              <button
                type="button"
                className={styles.cancelButton}
                disabled={isReviewing}
                onClick={() => setReviewTarget(null)}
              >
                돌아가기
              </button>
              <button
                type="button"
                className={
                  reviewTarget.action === "approve"
                    ? styles.approveButton
                    : styles.rejectConfirmButton
                }
                disabled={isReviewing}
                onClick={() => {
                  void submitReview();
                }}
              >
                {isReviewing && (
                  <LoaderCircle
                    size={16}
                    className={styles.spinner}
                    aria-hidden="true"
                  />
                )}
                {reviewTarget.action === "approve"
                  ? "부수 변경 승인"
                  : "후보 반려"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
