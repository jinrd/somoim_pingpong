import { Search, UserPlus } from "lucide-react";

import type { Member } from "../members/api";

import styles from "./Events.module.css";

interface Props {
  members: Member[];
  selectedMemberIds: Set<string>;
  searchKeyword: string;
  isLoading: boolean;
  isWorking: boolean;
  onSearchChange: (keyword: string) => void;
  onMemberToggle: (memberId: string) => void;
  onAddSelectedMembers: () => void;
  onGuestAdd: () => void;
}

export default function ParticipantMemberPicker({
  members,
  selectedMemberIds,
  searchKeyword,
  isLoading,
  isWorking,
  onSearchChange,
  onMemberToggle,
  onAddSelectedMembers,
  onGuestAdd,
}: Props) {
  return (
    <section className={styles.memberPicker}>
      <div className={styles.panelHeader}>
        <div>
          <h2>회원 추가</h2>
          <p>이번 회차에 참석하는 회원을 선택하세요.</p>
        </div>
      </div>

      <div className={styles.searchBox}>
        <Search size={18} aria-hidden="true" />

        <input
          type="search"
          value={searchKeyword}
          placeholder="이름 또는 닉네임 검색"
          aria-label="참석 가능 회원 검색"
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className={styles.memberSelectionList}>
        {isLoading ? (
          <p className={styles.panelEmpty}>회원 목록을 불러오는 중입니다…</p>
        ) : members.length === 0 ? (
          <p className={styles.panelEmpty}>추가할 수 있는 회원이 없습니다.</p>
        ) : (
          members.map((member) => (
            <label key={member.id} className={styles.memberSelectionItem}>
              <input
                type="checkbox"
                checked={selectedMemberIds.has(member.id)}
                onChange={() => onMemberToggle(member.id)}
              />

              <span className={styles.memberAvatar} aria-hidden="true">
                {member.nickname.trim().slice(0, 1)}
              </span>

              <span className={styles.memberSelectionContent}>
                <strong>{member.nickname}</strong>
                <small>
                  {member.name} · {member.rank}부
                </small>
              </span>
            </label>
          ))
        )}
      </div>

      <div className={styles.pickerActions}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={onAddSelectedMembers}
          disabled={isWorking || selectedMemberIds.size === 0}
        >
          <UserPlus size={18} aria-hidden="true" />
          선택한 회원 {selectedMemberIds.size}명 추가
        </button>

        <button
          type="button"
          className={styles.cancelButton}
          onClick={onGuestAdd}
          disabled={isWorking}
        >
          게스트 추가
        </button>
      </div>
    </section>
  );
}
