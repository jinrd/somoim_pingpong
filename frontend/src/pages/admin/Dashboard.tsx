import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  Award,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Copy,
  ShieldCheck,
  Trophy,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import styles from "./Dashboard.module.css";

const PARTICIPANT_GUIDE_TEXT = `[🏓 탁꾸러기 메이트 이용 안내]

1. 참석 링크에서 본인 확인
2. 참석 여부와 게임 참가 여부 선택
3. 제출 후 변경이 필요하면 운영진에게 요청
4. 모임 당일 [내 경기]에서 경기 순서와 탁구대 확인
5. 경기 후 양측이 같은 스코어를 입력하면 결과 확정
6. 잘못 입력한 결과는 운영진에게 취소 요청
7. [경기 현황]에서 전체 결과와 순위 확인`;

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"policy" | "admin" | "participant">("policy");
  const [copyStatus, setCopyStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const copyResetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current !== null) {
        window.clearTimeout(copyResetTimerRef.current);
      }
    };
  }, []);

  const handleCopyGuide = async () => {
    if (copyResetTimerRef.current !== null) {
      window.clearTimeout(copyResetTimerRef.current);
    }

    try {
      await navigator.clipboard.writeText(PARTICIPANT_GUIDE_TEXT);
      setCopyStatus("success");
    } catch {
      setCopyStatus("error");
    }

    copyResetTimerRef.current = window.setTimeout(() => {
      setCopyStatus("idle");
      copyResetTimerRef.current = null;
    }, 2000);
  };

  return (
    <div className={styles.dashboardContainer}>
      {/* Hero Header */}
      <header className={styles.heroHeader}>
        <div className={styles.heroBadge}>
          <Zap size={14} aria-hidden="true" />
          <span>오늘의 모임 운영</span>
        </div>
        <h1 className={styles.heroTitle}>탁꾸러기 메이트</h1>
        <p className={styles.heroSubtitle}>
          회원부터 경기 결과까지 한곳에서 관리하세요.
        </p>
      </header>

      {/* Quick Action Navigation Cards */}
      <section className={styles.quickActionsGrid} aria-label="빠른 메뉴">
        <Link to="/members" className={styles.actionCard}>
          <div className={styles.actionCardLeft}>
            <div className={`${styles.iconBox} ${styles.iconBoxMembers}`}>
              <Users size={26} aria-hidden="true" />
            </div>
            <div>
              <h3 className={styles.actionTitle}>회원 관리</h3>
              <p className={styles.actionDesc}>등록 · 수정 · 활동 상태</p>
            </div>
          </div>
          <ChevronRight size={20} className={styles.actionArrow} aria-hidden="true" />
        </Link>

        <Link to="/rankings" className={styles.actionCard}>
          <div className={styles.actionCardLeft}>
            <div className={`${styles.iconBox} ${styles.iconBoxRankings}`}>
              <Trophy size={26} aria-hidden="true" />
            </div>
            <div>
              <h3 className={styles.actionTitle}>부수 관리</h3>
              <p className={styles.actionDesc}>부수 설정 · 승강 후보</p>
            </div>
          </div>
          <ChevronRight size={20} className={styles.actionArrow} aria-hidden="true" />
        </Link>

        <Link to="/events" className={styles.actionCard}>
          <div className={styles.actionCardLeft}>
            <div className={`${styles.iconBox} ${styles.iconBoxEvents}`}>
              <CalendarDays size={26} aria-hidden="true" />
            </div>
            <div>
              <h3 className={styles.actionTitle}>회차 관리</h3>
              <p className={styles.actionDesc}>참가 · 편성 · 경기 진행</p>
            </div>
          </div>
          <ChevronRight size={20} className={styles.actionArrow} aria-hidden="true" />
        </Link>
      </section>

      {/* Embedded Operating Policy & User Guide Section */}
      <section className={styles.guideSection}>
        <div className={styles.sectionHeader}>
          <BookOpen size={24} className={styles.sectionIcon} aria-hidden="true" />
          <div>
            <h2 className={styles.sectionTitle}>운영 안내</h2>
            <p className={styles.sectionDescription}>
              필요한 내용을 선택해 빠르게 확인하세요.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabsContainer} role="tablist" aria-label="가이드 카테고리">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "policy"}
            className={`${styles.tabBtn} ${activeTab === "policy" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("policy")}
          >
            <ShieldCheck size={18} aria-hidden="true" />
            <span>운영 정책</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "admin"}
            className={`${styles.tabBtn} ${activeTab === "admin" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("admin")}
          >
            <Activity size={18} aria-hidden="true" />
            <span>운영진</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "participant"}
            className={`${styles.tabBtn} ${activeTab === "participant" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("participant")}
          >
            <UserCheck size={18} aria-hidden="true" />
            <span>참가자</span>
          </button>
        </div>

        {/* Tab 1: Operating Policy */}
        {activeTab === "policy" && (
          <div className={styles.guideContent}>
            <div className={styles.policyGrid}>
              <div className={styles.policyCard}>
                <div className={styles.policyCardHeader}>
                  <Award size={20} color="#4f46e5" aria-hidden="true" />
                  <span>회원과 부수</span>
                </div>
                <ul className={styles.policyList}>
                  <li>
                    <strong>부수:</strong> 0부가 가장 높으며 숫자가 클수록
                    낮은 부수입니다.
                  </li>
                  <li>
                    <strong>기본값:</strong> 신규 회원과 게스트 부수는 운영
                    설정을 따릅니다.
                  </li>
                  <li>
                    <strong>승급·강등:</strong> 공식 단식의 연속 경기 조건을
                    충족하면 후보가 생성되고 운영진 승인 후 반영됩니다.
                  </li>
                </ul>
              </div>

              <div className={styles.policyCard}>
                <div className={styles.policyCardHeader}>
                  <CalendarDays size={20} color="#059669" aria-hidden="true" />
                  <span>참가 신청과 편성</span>
                </div>
                <ul className={styles.policyList}>
                  <li>
                    <strong>참가 응답:</strong> 한 번 제출하면 참가자가 직접
                    바꿀 수 없으며 변경은 운영진에게 요청합니다.
                  </li>
                  <li>
                    <strong>신청 마감:</strong> 최종 마감 후에는 다시 열거나
                    참석자를 삭제할 수 없습니다.
                  </li>
                  <li>
                    <strong>팀 편성:</strong> 부수를 기준으로 자동 편성한 뒤
                    운영진이 팀원을 조정하고 확정합니다.
                  </li>
                </ul>
              </div>

              <div className={styles.policyCard}>
                <div className={styles.policyCardHeader}>
                  <Trophy size={20} color="#d97706" aria-hidden="true" />
                  <span>경기 결과와 순위</span>
                </div>
                <ul className={styles.policyList}>
                  <li>
                    <strong>결과 확정:</strong> 양측 입력이 일치하면 자동
                    확정됩니다. 불일치하거나 미입력된 경기는 운영진이
                    처리할 수 있습니다.
                  </li>
                  <li>
                    <strong>잘못된 결과:</strong> 참가자는 확정 결과를 직접
                    수정할 수 없으며 운영진이 취소 후 다시 입력합니다.
                  </li>
                  <li>
                    <strong>동률 순위:</strong> 승점 → 승자승 → 세트 득실률
                    순으로 결정합니다.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Admin Guide */}
        {activeTab === "admin" && (
          <div className={styles.guideContent}>
            <div className={styles.stepsTimeline}>
              <div className={styles.stepItem}>
                <div className={styles.stepBadge}>1</div>
                <div>
                  <h4 className={styles.stepTitle}>회차 만들기</h4>
                  <p className={styles.stepDesc}>
                    회차를 만든 뒤 참석 링크를 발급해 모임방에 공유합니다.
                  </p>
                </div>
              </div>

              <div className={styles.stepItem}>
                <div className={styles.stepBadge}>2</div>
                <div>
                  <h4 className={styles.stepTitle}>참가자 확인하고 마감하기</h4>
                  <p className={styles.stepDesc}>
                    게임 참가 인원을 확인한 뒤 신청을 최종 마감합니다.
                  </p>
                </div>
              </div>

              <div className={styles.stepItem}>
                <div className={styles.stepBadge}>3</div>
                <div>
                  <h4 className={styles.stepTitle}>게임 설정과 편성 확정하기</h4>
                  <p className={styles.stepDesc}>
                    운영 방식을 저장·확정합니다. 팀 리그는 팀 편성까지 확정한
                    뒤 대진표를 만듭니다.
                  </p>
                </div>
              </div>

              <div className={styles.stepItem}>
                <div className={styles.stepBadge}>4</div>
                <div>
                  <h4 className={styles.stepTitle}>경기 진행 확인하기</h4>
                  <p className={styles.stepDesc}>
                    진행·대기·완료 경기를 확인하고 미입력 또는 잘못된 결과를
                    운영진 권한으로 처리합니다.
                  </p>
                </div>
              </div>

              <div className={styles.stepItem}>
                <div className={styles.stepBadge}>5</div>
                <div>
                  <h4 className={styles.stepTitle}>회차와 부수 마무리하기</h4>
                  <p className={styles.stepDesc}>
                    모든 경기가 끝나면 회차 완료를 확인하고 부수 관리에서
                    승급·강등 후보를 검토합니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Participant Guide (With Copy Button) */}
        {activeTab === "participant" && (
          <div className={styles.guideContent}>
            <div className={styles.copyGuideHeader}>
              <div>
                <h3 className={styles.copyGuideTitle}>참가자 안내 문구</h3>
                <p className={styles.copyGuideDescription}>
                  모임방에 바로 공유할 수 있습니다.
                </p>
              </div>
              <button
                type="button"
                className={`${styles.copyBtn} ${copyStatus === "success" ? styles.copyBtnCopied : ""}`}
                aria-live="polite"
                onClick={() => {
                  void handleCopyGuide();
                }}
              >
                {copyStatus === "success" ? (
                  <>
                    <Check size={16} aria-hidden="true" />
                    <span>복사 완료</span>
                  </>
                ) : copyStatus === "error" ? (
                  <>
                    <Copy size={16} aria-hidden="true" />
                    <span>복사 실패</span>
                  </>
                ) : (
                  <>
                    <Copy size={16} aria-hidden="true" />
                    <span>문구 복사</span>
                  </>
                )}
              </button>
            </div>

            {/* Snippet box for easy reading & copy preview */}
            <div className={styles.snippetBox}>
              {PARTICIPANT_GUIDE_TEXT}
            </div>

            <div className={styles.stepsTimeline}>
              <div className={styles.stepItem}>
                <div className={styles.stepBadge}>1</div>
                <div>
                  <h4 className={styles.stepTitle}>본인 확인</h4>
                  <p className={styles.stepDesc}>
                    공유된 참석 링크에서 본인을 선택하고 안내에 따라
                    확인합니다.
                  </p>
                </div>
              </div>

              <div className={styles.stepItem}>
                <div className={styles.stepBadge}>2</div>
                <div>
                  <h4 className={styles.stepTitle}>참가 여부 제출</h4>
                  <p className={styles.stepDesc}>
                    참석 여부와 게임 참가 여부를 선택합니다. 제출 후 변경이
                    필요하면 운영진에게 요청합니다.
                  </p>
                </div>
              </div>

              <div className={styles.stepItem}>
                <div className={styles.stepBadge}>3</div>
                <div>
                  <h4 className={styles.stepTitle}>내 경기 확인</h4>
                  <p className={styles.stepDesc}>
                    내 경기에서 순서와 탁구대를 확인합니다. 팀 경기는 팀원과
                    라인업을 정해 제출합니다.
                  </p>
                </div>
              </div>

              <div className={styles.stepItem}>
                <div className={styles.stepBadge}>4</div>
                <div>
                  <h4 className={styles.stepTitle}>결과 입력</h4>
                  <p className={styles.stepDesc}>
                    경기 후 스코어를 입력합니다. 양측 결과가 같으면 자동
                    확정되며 잘못 입력했다면 운영진에게 요청합니다.
                  </p>
                </div>
              </div>

              <div className={styles.stepItem}>
                <div className={styles.stepBadge}>5</div>
                <div>
                  <h4 className={styles.stepTitle}>실시간 현황 확인</h4>
                  <p className={styles.stepDesc}>
                    경기 현황에서 전체 경기 결과와 현재 순위를 확인합니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
