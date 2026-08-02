import { useCallback, useMemo, useState } from "react";

import type { Member } from "../members/api";

export default function useParticipantMemberSelection(
  availableMembers: Member[],
) {
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [searchKeyword, setSearchKeyword] = useState("");

  const filteredMembers = useMemo(() => {
    const normalizedKeyword = searchKeyword.trim().toLowerCase();

    if (!normalizedKeyword) {
      return availableMembers;
    }

    return availableMembers.filter(
      (member) =>
        member.name.toLowerCase().includes(normalizedKeyword) ||
        member.nickname.toLowerCase().includes(normalizedKeyword),
    );
  }, [availableMembers, searchKeyword]);

  const toggleMemberSelection = useCallback((memberId: string) => {
    setSelectedMemberIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextIds.has(memberId)) {
        nextIds.delete(memberId);
      } else {
        nextIds.add(memberId);
      }

      return nextIds;
    });
  }, []);

  const resetMemberSelection = useCallback(() => {
    setSelectedMemberIds(new Set());
  }, []);

  return {
    selectedMemberIds,
    searchKeyword,
    filteredMembers,
    setSearchKeyword,
    toggleMemberSelection,
    resetMemberSelection,
  };
}
