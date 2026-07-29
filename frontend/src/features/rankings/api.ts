import { pb } from "../../lib/pocketbase";

export type RankingDirection = "promotion" | "demotion";
export type RankingCandidateStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "obsolete";

export interface RankingCandidate {
  id: string;
  memberId: string;
  memberName: string;
  memberNickname: string;
  direction: RankingDirection;
  currentRank: number;
  proposedRank: number;
  streakCount: number;
  threshold: number;
  status: RankingCandidateStatus;
  sourceType: "team_game" | "individual_match";
  calculatedAt: string;
  reviewedAt: string;
  reviewedByName: string;
  reviewNote: string;
  version: number;
}

export interface MemberRankingSummary {
  memberId: string;
  name: string;
  nickname: string;
  currentRank: number;
  status: "active" | "inactive";
  officialMatchCount: number;
  wins: number;
  losses: number;
  promotionStreak: number;
  demotionStreak: number;
  lastRankChangeAt: string;
  pendingCandidate: RankingCandidate | null;
}

export interface RankingOverview {
  settings: {
    minRank: number;
    maxRank: number;
    promotionThreshold: number;
    demotionThreshold: number;
  };
  pendingCandidateCount: number;
  officialMatchCount: number;
  members: MemberRankingSummary[];
  pendingCandidates: RankingCandidate[];
}

export interface MemberOfficialMatch {
  id: string;
  sourceType: "team_game" | "individual_match";
  eventId: string;
  eventTitle: string;
  confirmedAt: string;
  opponentName: string;
  ownRank: number;
  opponentRank: number;
  outcome: "win" | "loss";
  qualifiesFor: RankingDirection | "";
  ownScore: number;
  opponentScore: number;
}

export interface MemberRankHistory {
  id: string;
  previousRank: number;
  newRank: number;
  direction: RankingDirection | "manual";
  reason: string;
  approvedByName: string;
  effectiveAt: string;
}

export interface MemberRankingDetail {
  member: MemberRankingSummary;
  matches: MemberOfficialMatch[];
  rankHistory: MemberRankHistory[];
}

export interface ReviewCandidateInput {
  expectedVersion: number;
  note?: string;
}

export const getRankingOverview = async (): Promise<RankingOverview> => {
  return pb.send<RankingOverview>("/api/somoim/admin/rankings/overview", {
    method: "GET",
    requestKey: null,
  });
};

export const recalculateRankings = async (): Promise<RankingOverview> => {
  return pb.send<RankingOverview>("/api/somoim/admin/rankings/recalculate", {
    method: "POST",
    requestKey: null,
  });
};

export const getMemberRankingDetail = async (
  memberId: string,
): Promise<MemberRankingDetail> => {
  return pb.send<MemberRankingDetail>(
    `/api/somoim/admin/members/${encodeURIComponent(memberId)}/ranking`,
    {
      method: "GET",
      requestKey: null,
    },
  );
};

export const approveRankingCandidate = async (
  candidateId: string,
  input: ReviewCandidateInput,
): Promise<MemberRankingDetail> => {
  return pb.send<MemberRankingDetail>(
    `/api/somoim/admin/ranking-candidates/${encodeURIComponent(
      candidateId,
    )}/approve`,
    {
      method: "POST",
      body: input,
      requestKey: null,
    },
  );
};

export const rejectRankingCandidate = async (
  candidateId: string,
  input: ReviewCandidateInput,
): Promise<MemberRankingDetail> => {
  return pb.send<MemberRankingDetail>(
    `/api/somoim/admin/ranking-candidates/${encodeURIComponent(
      candidateId,
    )}/reject`,
    {
      method: "POST",
      body: input,
      requestKey: null,
    },
  );
};
