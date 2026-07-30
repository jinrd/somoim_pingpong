import { useEffect, useMemo, useState } from "react";
import styles from "./Members.module.css";
import { getMembers, getRankSettings } from "../../features/members/api";
import type { Member, RankSettings } from "../../features/members/api";
import MemberFormModal from "../../features/members/MemberFormModal";
import RankSettingsModal from "../../features/members/RankSettingsModal";
import { Edit, Search, Settings, Trophy, UserPlus } from "lucide-react";
import { DEFAULT_RANK_SETTINGS } from "../../config/domain";
import { useNavigate } from "react-router-dom";

type MemberStatusFilter = "all" | Member["status"];

const getGenderLabel = (gender: Member["gender"]): string => {
  if (gender === "M") {
    return "남성";
  }

  if (gender === "F") {
    return "여성";
  }

  return "-";
};

export default function Members() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [rankSettings, setRankSettings] = useState<RankSettings | null>(null);
  const effectiveRankSettings = rankSettings ?? DEFAULT_RANK_SETTINGS;

  const [isMemberModalOpen, setMemberModalOpen] = useState(false);
  const [isRankModalOpen, setRankModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<MemberStatusFilter>("all");

  const memberCounts = useMemo(
    () => ({
      all: members.length,
      active: members.filter((member) => member.status === "active").length,
      inactive: members.filter((member) => member.status === "inactive").length,
    }),
    [members],
  );

  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    const phoneQuery = query.replace(/[^0-9]/g, "");

    return members.filter((member) => {
      if (statusFilter !== "all" && member.status !== statusFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const text = `${member.name} ${member.nickname} ${member.phone ?? ""}`
        .toLocaleLowerCase()
        .replace(/\s+/g, " ");

      const phone = (member.phone ?? "").replace(/[^0-9]/g, "");

      return (
        text.includes(query) ||
        (phoneQuery.length > 0 && phone.includes(phoneQuery))
      );
    });
  }, [members, searchQuery, statusFilter]);

  const loadData = async () => {
    setError("");
    try {
      const [membersData, settingsData] = await Promise.all([
        getMembers(),
        getRankSettings(),
      ]);
      setMembers(membersData);
      setRankSettings(settingsData);
    } catch {
      setError(
        "회원 정보를 불러오지 못했습니다. 서버 연결과 로그인 상태를 확인해 주세요.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    Promise.all([getMembers(), getRankSettings()])
      .then(([membersData, settingsData]) => {
        if (cancelled) return;
        setMembers(membersData);
        setRankSettings(settingsData);
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            "회원 정보를 불러오지 못했습니다. 서버 연결과 로그인 상태를 확인해 주세요.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const openNewMember = () => {
    setSelectedMember(null);
    setMemberModalOpen(true);
  };

  const openEditMember = (member: Member) => {
    setSelectedMember(member);
    setMemberModalOpen(true);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>
          <h2>회원 관리</h2>
          <p>회원 정보와 활동 상태, 부수를 관리합니다.</p>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => setRankModalOpen(true)}
            className={styles.btnSecondary}
          >
            <Settings size={18} aria-hidden="true" />
            부수 승강 기준 설정
          </button>
          <button
            type="button"
            onClick={openNewMember}
            className={styles.btnPrimary}
          >
            <UserPlus size={18} aria-hidden="true" />새 회원 추가
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      <div className={styles.summary} aria-label="회원 상태 필터">
        {(
          [
            ["all", "전체", memberCounts.all],
            ["active", "활동중", memberCounts.active],
            ["inactive", "비활동", memberCounts.inactive],
          ] as const
        ).map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            className={
              statusFilter === value
                ? styles.summaryItemActive
                : styles.summaryItem
            }
            aria-pressed={statusFilter === value}
            onClick={() => setStatusFilter(value)}
          >
            <span>{label}</span>
            <strong>{count}</strong>
          </button>
        ))}
      </div>

      <div className={styles.toolbar}>
        <label className={styles.searchField}>
          <Search size={18} aria-hidden="true" />
          <span className={styles.srOnly}>회원 검색</span>
          <input
            type="search"
            placeholder="이름, 닉네임, 연락처 검색"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </label>

        <span className={styles.resultCount}>
          {filteredMembers.length}명 표시
        </span>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>이름</th>
              <th>닉네임</th>
              <th>부수</th>
              <th>성별</th>
              <th>연락처</th>
              <th>상태</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className={styles.emptyCell}>
                  불러오는 중…
                </td>
              </tr>
            ) : filteredMembers.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.emptyCell}>
                  {members.length === 0
                    ? "등록된 회원이 없습니다."
                    : "조건에 맞는 회원이 없습니다."}
                </td>
              </tr>
            ) : (
              filteredMembers.map((member) => (
                <tr key={member.id}>
                  <td>{member.name}</td>
                  <td>{member.nickname}</td>
                  <td>
                    <strong>{member.rank}부</strong>
                  </td>
                  <td>{getGenderLabel(member.gender)}</td>
                  <td>{member.phone || "-"}</td>
                  <td>
                    <span
                      className={
                        member.status === "active"
                          ? styles.activeBadge
                          : styles.inactiveBadge
                      }
                    >
                      {member.status === "active" ? "활동중" : "비활동"}
                    </span>
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      {/* <button
                        type="button"
                        onClick={() =>
                          navigate(`/rankings?member=${member.id}`)
                        }
                        className={styles.iconButton}
                        aria-label={`${member.nickname} 공식 단식 전적`}
                      >
                        <Trophy size={18} aria-hidden="true" />
                      </button> */}
                      <button
                        type="button"
                        onClick={() => openEditMember(member)}
                        className={styles.iconButton}
                        aria-label={`${member.nickname} 회원 수정`}
                      >
                        <Edit size={18} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.mobileMemberList}>
        {isLoading ? (
          <div className={styles.mobileEmpty}>불러오는 중…</div>
        ) : filteredMembers.length === 0 ? (
          <div className={styles.mobileEmpty}>
            {members.length === 0
              ? "등록된 회원이 없습니다."
              : "조건에 맞는 회원이 없습니다."}
          </div>
        ) : (
          filteredMembers.map((member) => (
            <article key={member.id} className={styles.mobileMemberCard}>
              <div className={styles.mobileMemberMain}>
                <span className={styles.avatar} aria-hidden="true">
                  {member.nickname.trim().charAt(0) ||
                    member.name.trim().charAt(0) ||
                    "?"}
                </span>

                <div className={styles.mobileIdentity}>
                  <strong>{member.nickname}</strong>
                  <span>{member.name}</span>
                </div>

                <div className={styles.mobileCardActions}>
                  <button
                    type="button"
                    onClick={() => navigate(`/rankings?member=${member.id}`)}
                    className={styles.mobileRecordButton}
                    aria-label={`${member.nickname} 공식 단식 전적`}
                  >
                    <Trophy size={16} aria-hidden="true" />
                    전적
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditMember(member)}
                    className={styles.mobileEditButton}
                    aria-label={`${member.nickname} 회원 수정`}
                  >
                    <Edit size={16} aria-hidden="true" />
                    수정
                  </button>
                </div>
              </div>

              <div className={styles.mobileMemberMeta}>
                <strong className={styles.rankBadge}>{member.rank}부</strong>

                <span
                  className={
                    member.status === "active"
                      ? styles.activeBadge
                      : styles.inactiveBadge
                  }
                >
                  {member.status === "active" ? "활동중" : "비활동"}
                </span>

                <span className={styles.contact}>
                  {getGenderLabel(member.gender)} ·{" "}
                  {member.phone || "연락처 없음"}
                </span>
              </div>
            </article>
          ))
        )}
      </div>

      {isMemberModalOpen && (
        <MemberFormModal
          key={selectedMember?.id ?? "new-member"}
          onClose={() => setMemberModalOpen(false)}
          initialData={selectedMember}
          rankSettings={effectiveRankSettings}
          onSaved={loadData}
        />
      )}
      {isRankModalOpen && (
        <RankSettingsModal
          key={rankSettings?.id ?? "new-rank-settings"}
          onClose={() => setRankModalOpen(false)}
          initialData={rankSettings}
          onSaved={loadData}
        />
      )}
    </div>
  );
}
