import { useCallback, useEffect, useMemo, useState } from "react";

import { RefreshCw, RotateCcw, Save, Shuffle } from "lucide-react";
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

import TeamFormationBoard from "./TeamFormationBoard";
import TeamFormationSummary from "./TeamFormationSummary";

import { TEAM_FORMATION_METHOD_LABELS } from "./constants";

import type {
  TeamDraft,
  TeamFormationContext,
  TeamFormationMethod,
  TeamFormationStatus,
} from "./types";

import styles from "./TeamFormationPanel.module.css";

interface Props {
  setting: EventGameSetting | null;
  onFormationChanged?: (status: TeamFormationStatus | null) => void;
  onScheduleReset?: () => void;
}

const cloneTeams = (teams: TeamDraft[]): TeamDraft[] =>
  teams.map((team) => ({
    ...team,
    members: team.members.map((member) => ({
      ...member,
    })),
  }));

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
};

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
            getErrorMessage(caughtError, "팀 편성 정보를 불러오지 못했습니다."),
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

  const handleMoveMember = (participantId: string, targetTeamKey: string) => {
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
      await unlockTeamFormation(setting.id, context.formation.version);
      onScheduleReset?.();
      onFormationChanged?.("draft");
      await loadContext();
      setMessage(
        "대진표와 라인업을 초기화하고 팀 편성을 초안으로 전환했습니다.",
      );
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
            자동 편성 후 PC에서는 드래그하고, 모바일에서는 이동할 팀을 선택하여
            조정할 수 있습니다.
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

      <TeamFormationSummary
        participantCount={context.participants.length}
        teamCount={teams.length}
        metrics={metrics}
      />

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
          disabled={isWorking || status === "confirmed" || history.length === 0}
          onClick={handleUndo}
        >
          <RotateCcw size={18} aria-hidden="true" />
          되돌리기
        </button>
      </div>

      <TeamFormationBoard
        teams={teams}
        disabled={isWorking || status === "confirmed"}
        onMemberMove={handleMoveMember}
        onTeamNameChange={(teamKey, name) => {
          setTeams((currentTeams) =>
            currentTeams.map((team) =>
              team.key === teamKey
                ? {
                    ...team,
                    name,
                  }
                : team,
            ),
          );
          setIsDirty(true);
        }}
      />

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
              {isWorking ? "저장 중…" : "저장"}
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
                {isWorking ? "확정 처리 중…" : "최종 확정"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
