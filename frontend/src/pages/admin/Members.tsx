import { useEffect, useMemo, useState } from "react";
import styles from "./Members.module.css";
import { getMembers, deleteMember } from "../../features/members/api";
import type { Member } from "../../features/members/api";
import MemberFormModal from "../../features/members/MemberFormModal";
import { Edit, Search, Trash2, UserPlus, Users } from "lucide-react";
import { ClientResponseError } from "pocketbase";

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
  const [members, setMembers] = useState<Member[]>([]);

  const [isMemberModalOpen, setMemberModalOpen] = useState(false);

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
      const membersData = await getMembers();
      setMembers(membersData);
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

    getMembers()
      .then((membersData) => {
        if (cancelled) return;
        setMembers(membersData);
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

  const handleDeleteMember = async (member: Member) => {
    const confirmed = window.confirm(
      `${member.nickname} 회원을 삭제하시겠습니까?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      await deleteMember(member.id);
      setMembers((currentMembers) =>
        currentMembers.filter(
          (currentMember) => currentMember.id !== member.id,
        ),
      );
    } catch (caughtError) {
      if (caughtError instanceof ClientResponseError) {
        if (caughtError.status === 401 || caughtError.status === 403) {
          setError("회원 삭제 권한이 없습니다. 다시 로그인해 주세요.");
        } else if (caughtError.status === 400) {
          setError(
            "이 회원을 참조하는 회차 또는 경기 기록이 있어 삭제할 수 없습니다.",
          );
        } else {
          setError(
            caughtError.response.message ||
              "회원 삭제에 실패했습니다. 다시 시도해 주세요.",
          );
        }
      } else {
        setError("회원 삭제에 실패했습니다. 다시 시도해 주세요.");
      }
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>
          <div className={styles.titleRow}>
            <span className={styles.pageIcon} aria-hidden="true">
              <Users size={22} />
            </span>
            <div>
              <span className={styles.eyebrow}>운영 관리</span>
              <h2>회원 관리</h2>
            </div>
          </div>
          <p className={styles.pagePurpose}>
            우리 모임의 회원 정보를 한곳에서 관리합니다.
          </p>
        </div>

        <div className={styles.actions}>
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
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>이름</th>
              <th>닉네임</th>
              <th>성별</th>
              <th>연락처</th>
              <th>상태</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className={styles.emptyCell}>
                  불러오는 중…
                </td>
              </tr>
            ) : filteredMembers.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.emptyCell}>
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
                      <button
                        type="button"
                        onClick={() => openEditMember(member)}
                        className={styles.iconButton}
                        aria-label={`${member.nickname} 회원 수정`}
                      >
                        <Edit size={18} aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteMember(member)}
                        className={styles.dangerIconButton}
                        aria-label={`${member.nickname} 회원 삭제`}
                      >
                        <Trash2 size={18} aria-hidden="true" />
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
                    onClick={() => openEditMember(member)}
                    className={styles.mobileEditButton}
                    aria-label={`${member.nickname} 회원 수정`}
                  >
                    <Edit size={16} aria-hidden="true" />
                    수정
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteMember(member)}
                    className={styles.mobileDeleteButton}
                    aria-label={`${member.nickname} 회원 삭제`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    삭제
                  </button>
                </div>
              </div>

              <div className={styles.mobileMemberMeta}>
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
          onSaved={loadData}
        />
      )}
    </div>
  );
}
