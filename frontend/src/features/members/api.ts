// frontend/src/features/members/api.ts
import { pb } from "../../lib/pocketbase";
import type { RecordModel } from "pocketbase";

export interface Member extends RecordModel {
  name: string;
  nickname: string;
  gender?: "M" | "F";
  phone?: string;
  rank: number;
  status: "active" | "inactive";
  memo?: string;
}

export interface RankSettings extends RecordModel {
  min_rank: number;
  max_rank: number;
  default_member_rank: number;
  default_guest_rank: number;
  promotion_threshold: number;
  demotion_threshold: number;
}

export interface MemberInput {
  name: string;
  nickname: string;
  gender?: "M" | "F";
  phone?: string;
  rank: number;
  status: "active" | "inactive";
  memo?: string;
}

export interface RankSettingsInput {
  min_rank: number;
  max_rank: number;
  default_member_rank: number;
  default_guest_rank: number;
  promotion_threshold: number;
  demotion_threshold: number;
}

// 회원 목록 조회
export const getMembers = async (): Promise<Member[]> => {
  return pb.collection("members").getFullList<Member>({
    sort: "-created",
  });
};

// 회원 추가
export const createMember = async (data: MemberInput): Promise<Member> => {
  await validateMemberRank(data.rank);
  return pb.collection("members").create<Member>(data);
};

// 회원 수정
export const updateMember = async (
  id: string,
  data: MemberInput,
): Promise<Member> => {
  await validateMemberRank(data.rank);
  return pb.collection("members").update<Member>(id, data);
};

// 승강 기준 조회 (보통 1개의 레코드만 존재)
export const getRankSettings = async (): Promise<RankSettings | null> => {
  const records = await pb
    .collection("rank_settings")
    .getList<RankSettings>(1, 1, {
      sort: "-updated",
    });
  return records.items[0] ?? null;
};

const validateMemberRank = async (rank: number): Promise<void> => {
  const settings = await getRankSettings();

  if (!settings) {
    throw new Error("부수 설정을 찾을 수 없습니다.");
  }

  if (
    !Number.isInteger(rank) ||
    rank < settings.min_rank ||
    rank > settings.max_rank
  ) {
    throw new Error(
      `부수는 ${settings.min_rank}부터 ${settings.max_rank} 사이의 정수여야 합니다.`,
    );
  }
};

// 승강 기준 수정 (또는 생성)
export const saveRankSettings = async (
  id: string | null,
  data: RankSettingsInput,
): Promise<RankSettings> => {
  if (id) {
    return pb.collection("rank_settings").update<RankSettings>(id, data);
  }

  return pb.collection("rank_settings").create<RankSettings>(data);
};
