import { useState } from "react";
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

const PARTICIPANT_GUIDE_TEXT = `[🏓 탁꾸러기 메이트 참석 및 이용 안내]

1. 참석 링크 접속 ➔ 본인 이름 선택 및 본인 확인
2. 참석/불참 여부 제출 (마감 전까지 변경 가능)
3. 모임 당일 [내 경기] 탭에서 탁구대 번호 확인 후 경기 진행
4. 경기 완료 후 세트 스코어(예: 2:1) 직접 입력
5. [경기 현황] 탭에서 실시간 팀/개인 순위 확인`;

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"policy" | "admin" | "participant">("policy");
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyGuide = () => {
    navigator.clipboard.writeText(PARTICIPANT_GUIDE_TEXT).then(() => {
      setIsCopied(true);
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    });
  };

  return (
    <div className={styles.dashboardContainer}>
      {/* Hero Header */}
      <header className={styles.heroHeader}>
        <div className={styles.heroBadge}>
          <Zap size={14} aria-hidden="true" />
          <span>탁꾸러기 메이트 공식 모임 매니저</span>
        </div>
        <h1 className={styles.heroTitle}>🏓 탁꾸러기 메이트 대시보드</h1>
        <p className={styles.heroSubtitle}>
          회원 및 부수 관리, 회차별 참가 신청, 팀/대진 구성부터 실시간 리그 모니터링까지 스마트하게 운영하세요.
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
              <p className={styles.actionDesc}>회원 등록, 닉네임, 연락처 및 활동 상태</p>
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
              <p className={styles.actionDesc}>부수 기준 포인트 & 승급/강등 후보 반영</p>
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
              <p className={styles.actionDesc}>회차 생성, 참석 링크 발급, 대진 및 진행</p>
            </div>
          </div>
          <ChevronRight size={20} className={styles.actionArrow} aria-hidden="true" />
        </Link>
      </section>

      {/* Embedded Operating Policy & User Guide Section */}
      <section className={styles.guideSection}>
        <div className={styles.sectionHeader}>
          <BookOpen size={24} className={styles.sectionIcon} aria-hidden="true" />
          <h2 className={styles.sectionTitle}>모임 운영 정책 및 가이드</h2>
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
            <span>운영 정책 (Policy)</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "admin"}
            className={`${styles.tabBtn} ${activeTab === "admin" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("admin")}
          >
            <Activity size={18} aria-hidden="true" />
            <span>운영진 사용 방법 (Admin)</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "participant"}
            className={`${styles.tabBtn} ${activeTab === "participant" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("participant")}
          >
            <UserCheck size={18} aria-hidden="true" />
            <span>참가자 가이드 (Member)</span>
          </button>
        </div>

        {/* Tab 1: Operating Policy */}
        {activeTab === "policy" && (
          <div className={styles.guideContent}>
            <div className={styles.policyGrid}>
              <div className={styles.policyCard}>
                <div className={styles.policyCardHeader}>
                  <Award size={20} color="#4f46e5" aria-hidden="true" />
                  <span>회원 및 부수 규정</span>
                </div>
                <ul className={styles.policyList}>
                  <li><strong>기본 부수:</strong> 신규 회원 및 게스트는 기본 6부로 적용됩니다.</li>
                  <li><strong>부수 범위:</strong> 1부부터 9부까지 운용하며, 수치가 작을수록 고부수입니다.</li>
                  <li><strong>승급/강등:</strong> 공식 단식 경기 승점이 기준 포인트를 달성하면 [부수 관리]에서 승인 반영됩니다.</li>
                </ul>
              </div>

              <div className={styles.policyCard}>
                <div className={styles.policyCardHeader}>
                  <CalendarDays size={20} color="#059669" aria-hidden="true" />
                  <span>참가 신청 및 팀 배치</span>
                </div>
                <ul className={styles.policyList}>
                  <li><strong>참가 마감:</strong> 참석 링크로 마감 전까지 자율 응답 후 운영진 마감 처리.</li>
                  <li><strong>팀 구성 (Balanced):</strong> 참가자 부수 합산 평균이 균등하도록 알고리즘이 자동 편성.</li>
                  <li><strong>개인전 풀리그:</strong> 테이블 수에 따라 1:1 풀리그가 자동 세팅됩니다.</li>
                </ul>
              </div>

              <div className={styles.policyCard}>
                <div className={styles.policyCardHeader}>
                  <Trophy size={20} color="#d97706" aria-hidden="true" />
                  <span>경기 결과 & 순위 규정</span>
                </div>
                <ul className={styles.policyList}>
                  <li><strong>결과 검증:</strong> 승자 입력 후 상대방 수락 시 최종 확정되며, 분쟁 시 운영진 대리 수정 가능.</li>
                  <li><strong>동률 발생 시 순위:</strong> ① 승리 수 ➔ ② 세트 득실률 ➔ ③ 승자승 우선순위로 결정.</li>
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
                  <h4 className={styles.stepTitle}>회차 생성 및 참석 링크 공유</h4>
                  <p className={styles.stepDesc}>
                    [회차 관리] ➔ [새 회차 생성]에서 모임 날짜 및 공지를 작성한 뒤, <strong>[참석 링크 복사]</strong>로 카톡방에 공유하세요.
                  </p>
                </div>
              </div>

              <div className={styles.stepItem}>
                <div className={styles.stepBadge}>2</div>
                <div>
                  <h4 className={styles.stepTitle}>참가 신청 마감 & 팀/대진 구성</h4>
                  <p className={styles.stepDesc}>
                    참석자 모집 완료 후 <strong>[참가 마감]</strong> 클릭 ➔ 팀 리그(자동 팀 배치) 또는 개인전 풀리그를 선택해 대진표를 생성합니다.
                  </p>
                </div>
              </div>

              <div className={styles.stepItem}>
                <div className={styles.stepBadge}>3</div>
                <div>
                  <h4 className={styles.stepTitle}>실시간 모니터링 & 승급 반영</h4>
                  <p className={styles.stepDesc}>
                    [경기 모니터링]에서 탁구대별 진행 현황을 파악하고 오입력을 관리합니다. 회차 종료 후 [부수 관리]에서 승급 대상자를 승인하세요.
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
              <h3 className={styles.copyGuideTitle}>📢 카카오톡 단톡방 전송용 안내 문구</h3>
              <button
                type="button"
                className={`${styles.copyBtn} ${isCopied ? styles.copyBtnCopied : ""}`}
                onClick={handleCopyGuide}
              >
                {isCopied ? (
                  <>
                    <Check size={16} aria-hidden="true" />
                    <span>클립보드에 복사됨!</span>
                  </>
                ) : (
                  <>
                    <Copy size={16} aria-hidden="true" />
                    <span>안내 문구 복사</span>
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
                  <h4 className={styles.stepTitle}>참석 링크 접속 및 본인 확인</h4>
                  <p className={styles.stepDesc}>
                    단톡방 공유 링크로 접속해 본인의 이름/연락처 뒷자리를 확인하고 등록합니다.
                  </p>
                </div>
              </div>

              <div className={styles.stepItem}>
                <div className={styles.stepBadge}>2</div>
                <div>
                  <h4 className={styles.stepTitle}>참가 여부 응답 & 라인업 제출</h4>
                  <p className={styles.stepDesc}>
                    [참석] / [미참석] 상태를 선택하고, 경기 시작 시 팀원 단식/복식 라인업을 작성합니다.
                  </p>
                </div>
              </div>

              <div className={styles.stepItem}>
                <div className={styles.stepBadge}>3</div>
                <div>
                  <h4 className={styles.stepTitle}>내 경기 스코어 입력 & 실시간 순위 조회</h4>
                  <p className={styles.stepDesc}>
                    [내 경기] 탭에서 내 탁구대 번호 확인 후 경기 세트 스코어를 입력하며, [경기 현황]에서 실시간 순위를 확인합니다.
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
