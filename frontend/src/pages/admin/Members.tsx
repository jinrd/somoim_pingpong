import { useEffect, useState } from "react";
import styles from "./Members.module.css";
import { getMembers, getRankSettings } from "../../features/members/api";
import type { Member, RankSettings } from "../../features/members/api";
import MemberFormModal from "../../features/members/MemberFormModal";
import RankSettingsModal from "../../features/members/RankSettingsModal";
import { Settings, UserPlus, Edit } from "lucide-react";
import { DEFAULT_RANK_SETTINGS } from "../../config/domain";

export default function Members() {
  const [members, setMembers] = useState<Member[]>([]);
  const [rankSettings, setRankSettings] = useState<RankSettings | null>(null);
  const effectiveRankSettings = rankSettings ?? DEFAULT_RANK_SETTINGS;

  const [isMemberModalOpen, setMemberModalOpen] = useState(false);
  const [isRankModalOpen, setRankModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

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
        <h2>회원 목록 (총 {members.length}명)</h2>
        <div className={styles.actions}>
          <button
            onClick={() => setRankModalOpen(true)}
            className={styles.btnSecondary}
          >
            <Settings
              size={18}
              style={{ verticalAlign: "middle", marginRight: 4 }}
            />
            부수 승강 기준 설정
          </button>
          <button onClick={openNewMember} className={styles.btnPrimary}>
            <UserPlus
              size={18}
              style={{ verticalAlign: "middle", marginRight: 4 }}
            />
            새 회원 추가
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

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
            ) : members.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.emptyCell}>
                  등록된 회원이 없습니다.
                </td>
              </tr>
            ) : (
              members.map((member) => (
                <tr key={member.id}>
                  <td>{member.name}</td>
                  <td>{member.nickname}</td>
                  <td>
                    <strong>{member.rank}부</strong>
                  </td>
                  <td>
                    {member.gender === "M"
                      ? "남성"
                      : member.gender === "F"
                        ? "여성"
                        : "-"}
                  </td>
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
                    <button
                      onClick={() => openEditMember(member)}
                      className={styles.iconButton}
                      aria-label={`${member.nickname} 회원 수정`}
                    >
                      <Edit size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
