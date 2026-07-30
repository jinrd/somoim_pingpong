import {
  ACCEPTABLE_AVERAGE_RANK_DIFFERENCE,
  BALANCE_IMPROVEMENT_EPSILON,
  MAXIMUM_BALANCE_OPTIMIZATION_PASSES,
  MINIMUM_TEAM_COUNT,
  TEAM_QUALITY_MAX_SCORE,
  TEAM_QUALITY_MEMBER_DIFFERENCE_PENALTY,
  TEAM_QUALITY_RANK_DIFFERENCE_PENALTY,
} from "./constants";

import type {
  FormationParticipant,
  GenerateTeamFormationOptions,
  TeamDraft,
  TeamFormationResult,
  TeamMemberDraft,
  TeamQualityMetrics,
} from "./types";

const validateParticipants = (participants: FormationParticipant[]): void => {
  const participantIds = participants.map(
    (participant) => participant.participantId,
  );

  if (new Set(participantIds).size !== participantIds.length) {
    throw new Error("중복된 참가자가 포함되어 있습니다.");
  }

  participants.forEach((participant) => {
    if (!participant.participantId.trim()) {
      throw new Error("참가자 ID가 비어 있습니다.");
    }

    if (!participant.displayName.trim()) {
      throw new Error("참가자 이름이 비어 있습니다.");
    }

    if (
      !Number.isInteger(participant.rankSnapshot) ||
      participant.rankSnapshot < 0
    ) {
      throw new Error(
        `${participant.displayName} 참가자의 부수 정보가 올바르지 않습니다.`,
      );
    }
  });
};

const validateTargetTeamSize = (targetTeamSize: number): void => {
  if (!Number.isInteger(targetTeamSize) || targetTeamSize < 1) {
    throw new Error("팀당 목표 인원은 1 이상의 정수여야 합니다.");
  }
};

/**
 * 0 → A팀
 * 25 → Z팀
 * 26 → AA팀
 */
export const createTeamName = (index: number): string => {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error("팀 이름 인덱스가 올바르지 않습니다.");
  }

  let current = index + 1;
  let name = "";

  while (current > 0) {
    current -= 1;

    name = String.fromCharCode(65 + (current % 26)) + name;

    current = Math.floor(current / 26);
  }

  return `${name}팀`;
};

const calculateTeamCount = (
  participantCount: number,
  targetTeamSize: number,
): number => {
  if (participantCount === 0) {
    return 0;
  }

  const calculatedTeamCount = Math.max(
    MINIMUM_TEAM_COUNT,
    Math.ceil(participantCount / targetTeamSize),
  );

  // 참가자 수보다 팀 수가 많아져 빈 팀이 생기는 것을 방지합니다.
  return Math.min(participantCount, calculatedTeamCount);
};

const calculateTeamCapacities = (
  participantCount: number,
  teamCount: number,
): number[] => {
  if (teamCount === 0) {
    return [];
  }

  const minimumSize = Math.floor(participantCount / teamCount);
  const largerTeamCount = participantCount % teamCount;

  return Array.from(
    { length: teamCount },
    (_, index) => minimumSize + (index < largerTeamCount ? 1 : 0),
  );
};

const toTeamMemberDraft = (
  participant: FormationParticipant,
): TeamMemberDraft => ({
  key: participant.participantId,
  ...participant,
});

const shuffleParticipants = (
  participants: FormationParticipant[],
  random: () => number,
): FormationParticipant[] => {
  const shuffled = [...participants];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const targetIndex = Math.floor(random() * (index + 1));

    [shuffled[index], shuffled[targetIndex]] = [
      shuffled[targetIndex],
      shuffled[index],
    ];
  }

  return shuffled;
};

const sortParticipantsByRank = (
  participants: FormationParticipant[],
): FormationParticipant[] => {
  return [...participants].sort((left, right) => {
    const rankDifference = left.rankSnapshot - right.rankSnapshot;

    if (rankDifference !== 0) {
      return rankDifference;
    }

    return left.participantId.localeCompare(right.participantId);
  });
};

const distributeParticipants = (
  participants: FormationParticipant[],
  capacities: number[],
): TeamMemberDraft[][] => {
  const teamMembers = capacities.map(() => [] as TeamMemberDraft[]);

  let participantIndex = 0;
  let direction: 1 | -1 = 1;

  while (participantIndex < participants.length) {
    const teamIndexes = capacities.map((_, index) => index);

    if (direction === -1) {
      teamIndexes.reverse();
    }

    teamIndexes.forEach((teamIndex) => {
      if (
        participantIndex >= participants.length ||
        teamMembers[teamIndex].length >= capacities[teamIndex]
      ) {
        return;
      }

      teamMembers[teamIndex].push(
        toTeamMemberDraft(participants[participantIndex]),
      );

      participantIndex += 1;
    });

    direction = direction === 1 ? -1 : 1;
  }

  return teamMembers;
};

const calculateAverageRank = (members: TeamMemberDraft[]): number => {
  if (members.length === 0) {
    return 0;
  }

  const totalRank = members.reduce(
    (total, member) => total + member.rankSnapshot,
    0,
  );

  return totalRank / members.length;
};

const calculateAverageRankDifference = (teams: TeamDraft[]): number => {
  const averages = teams
    .filter((team) => team.members.length > 0)
    .map((team) => calculateAverageRank(team.members));

  if (averages.length < 2) {
    return 0;
  }

  return Math.max(...averages) - Math.min(...averages);
};

/**
 * 팀원 수는 유지하면서 서로 다른 팀의 참가자를 교환해
 * 팀 평균 부수 차이가 줄어드는 조합을 탐색합니다.
 */
const optimizeBalancedTeams = (teams: TeamDraft[]): void => {
  for (let pass = 0; pass < MAXIMUM_BALANCE_OPTIMIZATION_PASSES; pass += 1) {
    const currentDifference = calculateAverageRankDifference(teams);

    let bestDifference = currentDifference;

    let bestSwap: {
      leftTeamIndex: number;
      rightTeamIndex: number;
      leftMemberIndex: number;
      rightMemberIndex: number;
    } | null = null;

    for (
      let leftTeamIndex = 0;
      leftTeamIndex < teams.length;
      leftTeamIndex += 1
    ) {
      for (
        let rightTeamIndex = leftTeamIndex + 1;
        rightTeamIndex < teams.length;
        rightTeamIndex += 1
      ) {
        const leftMembers = teams[leftTeamIndex].members;
        const rightMembers = teams[rightTeamIndex].members;

        for (
          let leftMemberIndex = 0;
          leftMemberIndex < leftMembers.length;
          leftMemberIndex += 1
        ) {
          for (
            let rightMemberIndex = 0;
            rightMemberIndex < rightMembers.length;
            rightMemberIndex += 1
          ) {
            [leftMembers[leftMemberIndex], rightMembers[rightMemberIndex]] = [
              rightMembers[rightMemberIndex],
              leftMembers[leftMemberIndex],
            ];

            const candidateDifference = calculateAverageRankDifference(teams);

            [leftMembers[leftMemberIndex], rightMembers[rightMemberIndex]] = [
              rightMembers[rightMemberIndex],
              leftMembers[leftMemberIndex],
            ];

            if (
              candidateDifference <
              bestDifference - BALANCE_IMPROVEMENT_EPSILON
            ) {
              bestDifference = candidateDifference;

              bestSwap = {
                leftTeamIndex,
                rightTeamIndex,
                leftMemberIndex,
                rightMemberIndex,
              };
            }
          }
        }
      }
    }

    if (!bestSwap) {
      return;
    }

    const leftMembers = teams[bestSwap.leftTeamIndex].members;
    const rightMembers = teams[bestSwap.rightTeamIndex].members;

    [
      leftMembers[bestSwap.leftMemberIndex],
      rightMembers[bestSwap.rightMemberIndex],
    ] = [
      rightMembers[bestSwap.rightMemberIndex],
      leftMembers[bestSwap.leftMemberIndex],
    ];
  }
};

const roundMetric = (value: number): number => Math.round(value * 100) / 100;

export const calculateTeamQuality = (
  teams: TeamDraft[],
): TeamQualityMetrics => {
  if (teams.length === 0) {
    return {
      qualityScore: 0,
      minimumTeamSize: 0,
      maximumTeamSize: 0,
      memberCountDifference: 0,
      minimumAverageRank: 0,
      maximumAverageRank: 0,
      averageRankDifference: 0,
    };
  }

  const teamSizes = teams.map((team) => team.members.length);

  const averageRanks = teams
    .filter((team) => team.members.length > 0)
    .map((team) => calculateAverageRank(team.members));

  const minimumTeamSize = Math.min(...teamSizes);
  const maximumTeamSize = Math.max(...teamSizes);

  const minimumAverageRank =
    averageRanks.length > 0 ? Math.min(...averageRanks) : 0;

  const maximumAverageRank =
    averageRanks.length > 0 ? Math.max(...averageRanks) : 0;

  const memberCountDifference = maximumTeamSize - minimumTeamSize;

  const averageRankDifference = maximumAverageRank - minimumAverageRank;

  const qualityScore = Math.max(
    0,
    TEAM_QUALITY_MAX_SCORE -
      averageRankDifference * TEAM_QUALITY_RANK_DIFFERENCE_PENALTY -
      memberCountDifference * TEAM_QUALITY_MEMBER_DIFFERENCE_PENALTY,
  );

  return {
    qualityScore: roundMetric(qualityScore),
    minimumTeamSize,
    maximumTeamSize,
    memberCountDifference,
    minimumAverageRank: roundMetric(minimumAverageRank),
    maximumAverageRank: roundMetric(maximumAverageRank),
    averageRankDifference: roundMetric(averageRankDifference),
  };
};

const createWarnings = (
  participantCount: number,
  teamCount: number,
  metrics: TeamQualityMetrics,
): string[] => {
  const warnings: string[] = [];

  if (participantCount === 0) {
    warnings.push("게임 참가 상태인 참석자가 없습니다.");

    return warnings;
  }

  if (teamCount < MINIMUM_TEAM_COUNT) {
    warnings.push(
      "팀 대결을 진행하려면 최소 두 팀을 만들 수 있어야 합니다. 개인 단식 리그를 검토해 주세요.",
    );
  }

  if (metrics.minimumTeamSize < 2) {
    warnings.push(
      "팀원이 한 명뿐인 팀이 있습니다. 복식 경기를 진행할 수 없습니다.",
    );
  }

  if (metrics.memberCountDifference > 1) {
    warnings.push("팀별 인원 차이가 1명을 초과합니다.");
  }

  if (metrics.averageRankDifference > ACCEPTABLE_AVERAGE_RANK_DIFFERENCE) {
    warnings.push(
      `팀 평균 부수 차이가 ${metrics.averageRankDifference}입니다. 운영자 조정을 권장합니다.`,
    );
  }

  return warnings;
};

export const generateTeamFormation = ({
  participants,
  targetTeamSize,
  method,
  random = Math.random,
}: GenerateTeamFormationOptions): TeamFormationResult => {
  validateTargetTeamSize(targetTeamSize);
  validateParticipants(participants);

  const participantCount = participants.length;

  const teamCount = calculateTeamCount(participantCount, targetTeamSize);

  const capacities = calculateTeamCapacities(participantCount, teamCount);

  const orderedParticipants =
    method === "balanced"
      ? sortParticipantsByRank(participants)
      : shuffleParticipants(participants, random);

  const distributedMembers = distributeParticipants(
    orderedParticipants,
    capacities,
  );

  const teams: TeamDraft[] = distributedMembers.map((members, index) => ({
    key: `team-${index + 1}`,
    name: createTeamName(index),
    sortOrder: index + 1,
    members,
  }));

  if (method === "balanced") {
    optimizeBalancedTeams(teams);
  }

  const metrics = calculateTeamQuality(teams);

  return {
    teams,
    participantCount,
    teamCount,
    metrics,
    warnings: createWarnings(participantCount, teamCount, metrics),
  };
};
