import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";

import { CSS } from "@dnd-kit/utilities";

import {
  GripVertical,
  RefreshCw,
  RotateCcw,
  Save,
  Shuffle,
  Users,
} from "lucide-react";

import type { EventGameSetting } from "../game-settings/types";

import {
  getTeamFormationContext,
  saveTeamFormation,
  unlockTeamFormation,
} from "./api";

import {
  calculateTeamQuality,
  generateTeamFormation,
} from "./generateTeamFormation";

import {
  TEAM_FORMATION_METHOD_LABELS,
} from "./constants";

import type {
  TeamDraft,
  TeamFormationContext,
  TeamFormationMethod,
  TeamFormationStatus,
  TeamMemberDraft,
} from "./types";

import styles from "./TeamFormationPanel.module.css";

interface Props {
  setting: EventGameSetting | null;
  onFormationChanged?: (status: TeamFormationStatus | null) => void;
  onScheduleReset?: () => void;
}

interface TeamMemberCardProps {
  member: TeamMemberDraft;
  teamKey: string;
  teams: TeamDraft[];
  disabled: boolean;
  onMove: (participantId: string, targetTeamKey: string) => void;
}

interface TeamColumnProps {
  team: TeamDraft;
  teams: TeamDraft[];
  disabled: boolean;
  onNameChange: (name: string) => void;
  onMemberMove: (participantId: string, targetTeamKey: string) => void;
}

const cloneTeams = (teams: TeamDraft[]): TeamDraft[] =>
  teams.map((team) => ({
    ...team,
    members: team.members.map((member) => ({
      ...member,
    })),
  }));

const calculateAverageRank = (team: TeamDraft): number => {
  if (team.members.length === 0) {
    return 0;
  }

  const total = team.members.reduce(
    (sum, member) => sum + member.rankSnapshot,
    0,
  );

  return Math.round((total / team.members.length) * 100) / 100;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
};

function TeamMemberCard({
  member,
  teamKey,
  teams,
  disabled,
  onMove,
}: TeamMemberCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `member:${member.participantId}`,
      data: {
        teamKey,
      },
      disabled,
    });

  return (
    <div
      ref={setNodeRef}
      className={isDragging ? styles.memberCardDragging : styles.memberCard}
      style={{
        transform: CSS.Translate.toString(transform),
      }}
    >
      <button
        type="button"
        className={styles.memberDragHandle}
        disabled={disabled}
        aria-label={`${member.displayName} 팀 이동`}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={17} aria-hidden="true" />
      </button>

      <div className={styles.memberInfo}>
        <strong>{member.displayName}</strong>

        <span>
          {member.rankSnapshot}부 ·{" "}
          {member.participantType === "guest" ? "게스트" : "회원"}
        </span>
      </div>

      <label className={styles.mobileTeamMove}>
        <span className={styles.visuallyHidden}>
          {member.displayName} 이동할 팀
        </span>

        <select
          value={teamKey}
          disabled={disabled}
          aria-label={`${member.displayName} 이동할 팀`}
          onChange={(event) => {
            onMove(member.participantId, event.target.value);
          }}
        >
          {teams.map((team) => (
            <option key={team.key} value={team.key}>
              {team.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function TeamColumn({
  team,
  teams,
  disabled,
  onNameChange,
  onMemberMove,
}: TeamColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `team:${team.key}`,
    disabled,
  });

  const averageRank = calculateAverageRank(team);

  return (
    <article
      ref={setNodeRef}
      className={isOver ? styles.teamColumnOver : styles.teamColumn}
    >
      <header className={styles.teamHeader}>
        <input
          value={team.name}
          maxLength={30}
          disabled={disabled}
          aria-label={`${team.name} 팀 이름`}
          onChange={(event) => {
            onNameChange(event.target.value);
          }}
        />

        <div className={styles.teamStats}>
          <span>{team.members.length}명</span>
          <span>평균 {averageRank || "-"}부</span>
        </div>
      </header>

      <div className={styles.memberList}>
        {team.members.length === 0 ? (
          <p className={styles.emptyTeam}>이곳에 팀원을 놓으세요.</p>
        ) : (
          team.members.map((member) => (
            <TeamMemberCard
              key={member.key}
              member={member}
              teamKey={team.key}
              teams={teams}
              disabled={disabled}
              onMove={onMemberMove}
            />
          ))
        )}
      </div>
    </article>
  );
}

export default function TeamFormationPanel({
  setting,
  onFormationChanged,
  onScheduleReset,
}: Props) {
  const [context, setContext] = useState<TeamFormationContext | null>(null);

  const [teams, setTeams] = useState<TeamDraft[]>([]);

  const [history, setHistory] = useState<TeamDraft[][]>([]);

  const [method, setMethod] = useState<TeamFormationMethod>("balanced");

  const [status, setStatus] = useState<TeamFormationStatus>("draft");

  const [warnings, setWarnings] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(true);

  const [isWorking, setIsWorking] = useState(false);

  const [isDirty, setIsDirty] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isConfirmFormationOpen, setConfirmFormationOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor),
  );

  const metrics = useMemo(() => calculateTeamQuality(teams), [teams]);

  const loadContext = useCallback(async () => {
    if (
      !setting ||
      setting.competition_type !== "team_league" ||
      setting.status !== "confirmed"
    ) {
      return;
    }

    try {
      const loaded = await getTeamFormationContext(setting.id);

      setContext(loaded);
      setTeams(cloneTeams(loaded.teams));
      setHistory([]);
      setWarnings([]);
      setIsDirty(false);

      if (loaded.formation) {
        setMethod(loaded.formation.method);
        setStatus(loaded.formation.status);
        onFormationChanged?.(loaded.formation.status);
      } else {
        setMethod(setting.auto_team_balance ? "balanced" : "random");

        setStatus("draft");
        onFormationChanged?.(null);
      }
    } catch (caughtError) {
      setError(
        getErrorMessage(caughtError, "팀 편성 정보를 불러오지 못했습니다."),
      );
    } finally {
      setIsLoading(false);
    }
  }, [onFormationChanged, setting]);

  useEffect(() => {
    if (
      !setting ||
      setting.competition_type !== "team_league" ||
      setting.status !== "confirmed"
    ) {
      return;
    }

    let cancelled = false;

    getTeamFormationContext(setting.id)
      .then((loaded) => {
        if (cancelled) {
          return;
        }

        setContext(loaded);
        setTeams(cloneTeams(loaded.teams));
        setHistory([]);
        setWarnings([]);
        setIsDirty(false);

        if (loaded.formation) {
          setMethod(loaded.formation.method);
          setStatus(loaded.formation.status);
          onFormationChanged?.(loaded.formation.status);
        } else {
          setMethod(setting.auto_team_balance ? "balanced" : "random");
          setStatus("draft");
          onFormationChanged?.(null);
        }
      })
      .catch((caughtError) => {
        if (!cancelled) {
          setError(
            getErrorMessage(
              caughtError,
              "팀 편성 정보를 불러오지 못했습니다.",
            ),
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [onFormationChanged, setting]);

  const handleReload = () => {
    setIsLoading(true);
    setError("");
    setMessage("");

    void loadContext();
  };

  const rememberCurrentTeams = () => {
    if (teams.length === 0) {
      return;
    }

    setHistory((current) => [...current.slice(-9), cloneTeams(teams)]);
  };

  const handleGenerate = () => {
    if (!context) {
      return;
    }

    try {
      const result = generateTeamFormation({
        participants: context.participants,
        targetTeamSize: setting?.team_size ?? 1,
        method,
      });

      rememberCurrentTeams();

      setTeams(result.teams);
      setWarnings(result.warnings);
      setIsDirty(true);
      setError("");
      setMessage(
        `${result.participantCount}명을 ${result.teamCount}팀으로 편성했습니다.`,
      );
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "팀을 자동 편성하지 못했습니다."));
    }
  };

  const handleMoveMember = (
    participantId: string,
    targetTeamKey: string,
  ) => {
    const sourceTeam = teams.find((team) =>
      team.members.some((member) => member.participantId === participantId),
    );

    if (!sourceTeam || sourceTeam.key === targetTeamKey) {
      return;
    }

    const member = sourceTeam.members.find(
      (current) => current.participantId === participantId,
    );

    if (!member) {
      return;
    }

    rememberCurrentTeams();

    const nextTeams = teams.map((team) => {
      if (team.key === sourceTeam.key) {
        return {
          ...team,
          members: team.members.filter(
            (current) => current.participantId !== participantId,
          ),
        };
      }

      if (team.key === targetTeamKey) {
        return {
          ...team,
          members: [...team.members, member],
        };
      }

      return team;
    });

    setTeams(nextTeams);
    setWarnings(
      nextTeams.some((team) => team.members.length === 0)
        ? ["팀원이 없는 팀은 저장할 수 없습니다."]
        : [],
    );

    setIsDirty(true);
    setError("");
    setMessage(`${member.displayName} 님을 이동했습니다.`);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const overId = event.over ? String(event.over.id) : "";

    if (!overId.startsWith("team:")) {
      return;
    }

    const participantId = String(event.active.id).replace(/^member:/, "");
    const targetTeamKey = overId.replace(/^team:/, "");

    handleMoveMember(participantId, targetTeamKey);
  };

  const handleUndo = () => {
    const previous = history[history.length - 1];

    if (!previous) {
      return;
    }

    setTeams(cloneTeams(previous));
    setHistory((current) => current.slice(0, -1));
    setWarnings([]);
    setIsDirty(true);
    setError("");
    setMessage("직전 편성으로 되돌렸습니다.");
  };

  const handleSave = async (nextStatus: TeamFormationStatus) => {
    if (!context || !setting) {
      return;
    }

    if (nextStatus === "confirmed") {
      setConfirmFormationOpen(false);
    }

    setIsWorking(true);
    setError("");
    setMessage("");

    try {
      const saved = await saveTeamFormation(setting.id, {
        method,
        status: nextStatus,

        expectedVersion: context.formation?.version ?? 0,

        teams: teams.map((team) => ({
          id: team.id,
          name: team.name,

          participantIds: team.members.map((member) => member.participantId),
        })),
      });

      setContext(saved);
      setTeams(cloneTeams(saved.teams));
      setMethod(saved.formation?.method ?? method);
      setStatus(saved.formation?.status ?? status);
      onFormationChanged?.(saved.formation?.status ?? null);
      setIsDirty(false);
      setWarnings([]);
      setMessage(
        nextStatus === "confirmed"
          ? "팀 편성을 최종 확정했습니다."
          : "팀 편성 초안을 저장했습니다.",
      );
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "팀 편성을 저장하지 못했습니다."));
    } finally {
      setIsWorking(false);
    }
  };

  const handleUnlock = async () => {
    if (!setting || !context?.formation || status !== "confirmed") {
      return;
    }

    if (
      !window.confirm(
        "팀 편성 수정을 시작할까요?\n\n저장된 대진표와 라인업이 모두 초기화되며 되돌릴 수 없습니다. 현재 팀 편성은 초안으로 유지됩니다.",
      )
    ) {
      return;
    }

    setIsWorking(true);
    setError("");
    setMessage("");

    try {
      await unlockTeamFormation(
        setting.id,
        context.formation.version,
      );
      onScheduleReset?.();
      onFormationChanged?.("draft");
      await loadContext();
      setMessage("대진표와 라인업을 초기화하고 팀 편성을 초안으로 전환했습니다.");
    } catch (caughtError) {
      setError(
        getErrorMessage(caughtError, "팀 편성 수정을 시작하지 못했습니다."),
      );
    } finally {
      setIsWorking(false);
    }
  };

  if (!setting) {
    return (
      <section className={styles.panel}>
        <h2>팀 편성</h2>

        <p className={styles.notice}>
          팀을 편성하려면 먼저 게임 설정을 저장해 주세요.
        </p>
      </section>
    );
  }

  if (setting.competition_type !== "team_league") {
    return (
      <section className={styles.panel}>
        <h2>팀 편성</h2>

        <p className={styles.notice}>
          개인 단식 풀리그는 팀을 편성하지 않습니다.
        </p>
      </section>
    );
  }

  if (setting.status !== "confirmed") {
    return (
      <section className={styles.panel}>
        <h2>팀 편성</h2>
        <p className={styles.notice}>
          게임 설정을 최종 확정하면 팀 편성을 시작할 수 있습니다.
        </p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className={styles.panel}>
        팀 편성 정보를 불러오는 중입니다…
      </section>
    );
  }

  if (!context) {
    return (
      <section className={styles.panel}>
        <p className={styles.error}>
          {error || "팀 편성 정보를 불러오지 못했습니다."}
        </p>

        <button
          type="button"
          className={styles.secondaryButton}
          onClick={handleReload}
        >
          다시 불러오기
        </button>
      </section>
    );
  }

  return (
    <section className={styles.panel}>
      <header className={styles.panelHeader}>
        <div>
          <h2>팀 편성</h2>

          <p>
            자동 편성 후 PC에서는 드래그하고, 모바일에서는 이동할 팀을
            선택하여 조정할 수 있습니다.
          </p>
        </div>

        <button
          type="button"
          className={styles.secondaryButton}
          disabled={isWorking}
          onClick={handleReload}
        >
          <RefreshCw size={17} aria-hidden="true" />
          최신 명단
        </button>
      </header>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {message && (
        <p className={styles.success} role="status">
          {message}
        </p>
      )}

      {warnings.map((warning) => (
        <p key={warning} className={styles.warning}>
          {warning}
        </p>
      ))}

      <div className={styles.summaryGrid}>
        <div>
          <Users size={20} aria-hidden="true" />
          <span>게임 참가자</span>
          <strong>{context.participants.length}명</strong>
        </div>

        <div>
          <span>팀 수</span>
          <strong>{teams.length}팀</strong>
        </div>

        <div>
          <span>품질 점수</span>
          <strong>{metrics.qualityScore}점</strong>
        </div>

        <div>
          <span>평균 부수 차이</span>
          <strong>{metrics.averageRankDifference}</strong>
        </div>
      </div>

      <div className={styles.controls}>
        <label>
          <span>자동 편성 방식</span>

          <select
            value={method}
            disabled={isWorking || status === "confirmed"}
            onChange={(event) => {
              setMethod(event.target.value as TeamFormationMethod);
            }}
          >
            {Object.entries(TEAM_FORMATION_METHOD_LABELS).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ),
            )}
          </select>
        </label>

        <button
          type="button"
          className={styles.primaryButton}
          disabled={
            isWorking ||
            status === "confirmed" ||
            context.participants.length === 0
          }
          onClick={handleGenerate}
        >
          <Shuffle size={18} aria-hidden="true" />팀 자동 편성
        </button>

        <button
          type="button"
          className={styles.secondaryButton}
          disabled={
            isWorking || status === "confirmed" || history.length === 0
          }
          onClick={handleUndo}
        >
          <RotateCcw size={18} aria-hidden="true" />
          되돌리기
        </button>
      </div>

      {teams.length === 0 ? (
        <div className={styles.emptyFormation}>
          <Users size={30} aria-hidden="true" />

          <strong>아직 편성된 팀이 없습니다.</strong>

          <span>자동 편성 버튼을 눌러 주세요.</span>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragEnd={handleDragEnd}
        >
          <div className={styles.teamGrid}>
            {teams.map((team) => (
              <TeamColumn
                key={team.key}
                team={team}
                teams={teams}
                disabled={isWorking || status === "confirmed"}
                onMemberMove={handleMoveMember}
                onNameChange={(name) => {
                  setTeams((current) =>
                    current.map((item) =>
                      item.key === team.key
                        ? {
                            ...item,
                            name,
                          }
                        : item,
                    ),
                  );

                  setIsDirty(true);
                }}
              />
            ))}
          </div>
        </DndContext>
      )}

      <footer className={styles.saveBar}>
        {isDirty && <span>저장하지 않은 변경 사항이 있습니다.</span>}

        {status === "confirmed" ? (
          <button
            type="button"
            className={styles.dangerButton}
            disabled={isWorking}
            onClick={() => void handleUnlock()}
          >
            편성 수정
          </button>
        ) : (
          <>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={
                isWorking ||
                !isDirty ||
                teams.length === 0 ||
                teams.some((team) => team.members.length === 0)
              }
              onClick={() => void handleSave("draft")}
            >
              <Save size={18} aria-hidden="true" />
              {isWorking ? "저장 중…" : "임시 저장"}
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={
                isWorking ||
                teams.length < 2 ||
                teams.some((team) => team.members.length === 0)
              }
              onClick={() => {
                setError("");
                setMessage("");
                setConfirmFormationOpen(true);
              }}
            >
              최종 확정
            </button>
          </>
        )}
      </footer>

      {isConfirmFormationOpen && (
        <div className={styles.confirmOverlay}>
          <section
            className={styles.confirmDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-team-formation-title"
            aria-describedby="confirm-team-formation-description"
          >
            <h2 id="confirm-team-formation-title">
              팀 편성을 최종 확정할까요?
            </h2>

            <p id="confirm-team-formation-description">
              현재 저장된 팀 구성과 팀원 배치를 최종 확정합니다.
            </p>

            <p>
              확정 후 수정하려면 저장된 대진표와 라인업이 모두 초기화됩니다.
            </p>

            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={isWorking}
                onClick={() => setConfirmFormationOpen(false)}
              >
                취소
              </button>

              <button
                type="button"
                className={styles.confirmFormationButton}
                disabled={isWorking}
                onClick={() => void handleSave("confirmed")}
              >
                {isWorking ? "확정 처리 중…" : "확인하고 최종 확정"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
