import { useCallback, useEffect, useState } from "react";

import { ClientResponseError } from "pocketbase";

import { RefreshCw, Save, Shuffle, Trash2 } from "lucide-react";

import type { EventGameSetting } from "../game-settings/types";

import {
  getTeamSchedule,
  saveTeamSchedule,
  type StoredScheduleRound,
  type TeamScheduleContext,
} from "./api";

import {
  generateRoundRobin,
  type RoundRobinSchedule,
  type ScheduledRound,
} from "./generateRoundRobin";

import styles from "./TeamSchedulePanel.module.css";

interface Props {
  setting: EventGameSetting | null;
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof ClientResponseError) {
    return error.response?.message || error.message || fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
};

const getMatchTypeLabel = (matchType: "singles" | "doubles"): string => {
  return matchType === "singles" ? "단식" : "복식";
};

const getLineupLabel = (status: "draft" | "confirmed"): string => {
  return status === "confirmed" ? "확정" : "작성 중";
};

const shuffleTeamsForSchedule = (
  teams: TeamScheduleContext["teams"],
): TeamScheduleContext["teams"] => {
  const shuffled = [...teams];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));

    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }

  /*
   * generateRoundRobin은 sortOrder 순으로 팀을 다시 정렬하므로
   * 섞인 순서에 맞춰 임시 sortOrder를 새로 지정합니다.
   */
  return shuffled.map((team, index) => ({
    ...team,
    sortOrder: index + 1,
  }));
};

const getMatchOrderSignature = (
  matches: Array<{ pairKey: string; sortOrder: number }>,
): string =>
  [...matches]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((match) => match.pairKey)
    .join("|");

export default function TeamSchedulePanel({ setting }: Props) {
  const [context, setContext] = useState<TeamScheduleContext | null>(null);

  const [preview, setPreview] = useState<RoundRobinSchedule | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const applyLoadedSchedule = useCallback((loaded: TeamScheduleContext) => {
    setContext(loaded);

    if (
      loaded.totalMatchCount === 0 &&
      loaded.formation?.status === "confirmed" &&
      loaded.teams.length >= 2
    ) {
      setPreview(generateRoundRobin(loaded.teams));
    } else {
      setPreview(null);
    }
  }, []);

  const loadSchedule = useCallback(async () => {
    if (!setting || setting.competition_type !== "team_league") {
      setContext(null);
      setPreview(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const loaded = await getTeamSchedule(setting.id);

      applyLoadedSchedule(loaded);
    } catch (caughtError) {
      setError(
        getErrorMessage(caughtError, "대진 정보를 불러오지 못했습니다."),
      );
    } finally {
      setIsLoading(false);
    }
  }, [applyLoadedSchedule, setting]);

  useEffect(() => {
    if (!setting || setting.competition_type !== "team_league") {
      return;
    }

    let cancelled = false;

    getTeamSchedule(setting.id)
      .then((loaded) => {
        if (cancelled) {
          return;
        }

        applyLoadedSchedule(loaded);
        setError("");
      })
      .catch((caughtError) => {
        if (!cancelled) {
          setError(
            getErrorMessage(caughtError, "대진 정보를 불러오지 못했습니다."),
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
  }, [applyLoadedSchedule, setting]);

  const handleGeneratePreview = () => {
    if (!context) {
      return;
    }

    try {
      if (context.teams.length < 3) {
        setError("팀이 2개이면 가능한 대진이 한 경기뿐입니다.");
        return;
      }

      const currentSignature = preview
        ? getMatchOrderSignature(preview.matches)
        : getMatchOrderSignature(
            context.rounds.flatMap((round) => round.matches),
          );

      let nextSchedule: RoundRobinSchedule | null = null;

      for (let attempt = 0; attempt < 20; attempt += 1) {
        const candidate = generateRoundRobin(
          shuffleTeamsForSchedule(context.teams),
        );

        if (getMatchOrderSignature(candidate.matches) !== currentSignature) {
          nextSchedule = candidate;
          break;
        }
      }

      if (!nextSchedule) {
        setError("다른 경기 순서를 만들지 못했습니다. 다시 시도해 주세요.");
        return;
      }

      setPreview(nextSchedule);

      setError("");
      setMessage("대진 미리보기를 생성했습니다. 저장 전 내용을 확인해 주세요.");
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "대진을 생성하지 못했습니다."));
    }
  };

  const handleSave = async () => {
    if (!setting || !context || !context.formation || !preview) {
      return;
    }

    if (
      context.totalMatchCount > 0 &&
      !window.confirm(
        "기존 대진과 작성 중인 라인업을 삭제하고 다시 생성할까요?",
      )
    ) {
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const result = await saveTeamSchedule(setting.id, {
        expectedFormationVersion: context.formation.version,

        expectedScheduleVersion: context.scheduleVersion,

        schedule: preview,
      });

      setMessage(
        `${result.totalRoundCount}라운드, ${result.totalMatchCount}경기를 저장했습니다.`,
      );

      await loadSchedule();
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "대진을 저장하지 못했습니다."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSchedule = async () => {
    if (!setting || !context) return;
    
    if (
      !window.confirm(
        "정말로 기존 대진표를 완전히 삭제하시겠습니까?\n삭제 후에는 운영 방식을 변경할 수 있습니다.",
      )
    ) {
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const { deleteSchedule } = await import("./api");
      await deleteSchedule(setting.id);
      
      setMessage("대진표가 완전히 삭제되었습니다.");
      setContext(null);
      
      window.dispatchEvent(new Event("scheduleDeleted"));
      
      void loadSchedule();
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "대진표를 삭제하지 못했습니다."));
    } finally {
      setIsSaving(false);
    }
  };

  if (!setting) {
    return (
      <section className={styles.panel}>
        <h2>대진표</h2>
        <p>게임 설정을 먼저 저장해 주세요.</p>
      </section>
    );
  }

  if (setting.competition_type !== "team_league") {
    return (
      <section className={styles.panel}>
        <h2>대진표</h2>
        <p>개인 단식 풀리그 대진은 이후 단계에서 연결합니다.</p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className={styles.panel}>대진 정보를 불러오는 중입니다…</section>
    );
  }

  if (!context) {
    return (
      <section className={styles.panel}>
        <p className={styles.error}>
          {error || "대진 정보를 불러오지 못했습니다."}
        </p>

        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => {
            void loadSchedule();
          }}
        >
          다시 불러오기
        </button>
      </section>
    );
  }

  if (!context.formation) {
    return (
      <section className={styles.panel}>
        <h2>대진표</h2>
        <p>먼저 팀을 편성하고 저장해 주세요.</p>
      </section>
    );
  }

  if (context.formation.status !== "confirmed") {
    return (
      <section className={styles.panel}>
        <h2>대진표</h2>
        <p>팀 편성 상태를 확정한 후 대진을 만들 수 있습니다.</p>
      </section>
    );
  }

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div>
          <h2>팀 풀리그 대진표</h2>
          <p>모든 팀이 다른 팀과 한 번씩 경기합니다.</p>
        </div>

        <button
          type="button"
          className={styles.secondaryButton}
          disabled={isSaving}
          onClick={() => {
            void loadSchedule();
          }}
        >
          <RefreshCw size={17} aria-hidden="true" />
          저장본 다시 불러오기
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

      <div className={styles.summary}>
        <div>
          <span>팀</span>
          <strong>{context.teams.length}팀</strong>
        </div>

        <div>
          <span>라운드</span>
          <strong>{preview?.totalRoundCount ?? context.totalRoundCount}</strong>
        </div>

        <div>
          <span>팀 대진</span>
          <strong>
            {preview?.totalMatchCount ?? context.totalMatchCount}
            경기
          </strong>
        </div>

        <div>
          <span>세부 경기</span>
          <strong>{context.formats.length}경기씩</strong>
        </div>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={
            isSaving || (!context.canRegenerate && context.totalMatchCount > 0)
          }
          onClick={handleGeneratePreview}
        >
          <Shuffle size={17} aria-hidden="true" />
          {context.totalMatchCount > 0
            ? "경기 순서 새로 구성"
            : "대진 미리보기"}
        </button>

        {preview && (
          <button
            type="button"
            className={styles.primaryButton}
            disabled={isSaving}
            onClick={() => {
              void handleSave();
            }}
          >
            <Save size={17} aria-hidden="true" />
            {isSaving ? "저장 중…" : "이 대진으로 저장"}
          </button>
        )}

        {!preview && context.totalMatchCount > 0 && (
          <button
            type="button"
            className={styles.dangerButton || styles.secondaryButton}
            disabled={isSaving}
            onClick={() => {
              void handleDeleteSchedule();
            }}
          >
            <Trash2 size={17} aria-hidden="true" />
            대진표 삭제 (초기화)
          </button>
        )}
      </div>

      {preview ? (
        <PreviewRounds rounds={preview.rounds} formats={context.formats} />
      ) : (
        <StoredRounds rounds={context.rounds} />
      )}
    </section>
  );
}

interface PreviewRoundsProps {
  rounds: ScheduledRound[];

  formats: TeamScheduleContext["formats"];
}

function PreviewRounds({ rounds, formats }: PreviewRoundsProps) {
  return (
    <div className={styles.roundList}>
      {rounds.map((round) => (
        <article key={round.round} className={styles.roundCard}>
          <header>
            <h3>{round.round}라운드</h3>

            {round.byeTeam && <span>휴식: {round.byeTeam.name}</span>}
          </header>

          <div className={styles.matchList}>
            {round.matches.map((match) => (
              <div key={match.key} className={styles.matchCard}>
                <div className={styles.teams}>
                  <strong>{match.homeTeamName}</strong>

                  <span>VS</span>

                  <strong>{match.awayTeamName}</strong>
                </div>

                <div className={styles.formatList}>
                  {formats.map((format) => (
                    <span key={format.sequence}>
                      {format.sequence}. {getMatchTypeLabel(format.matchType)} ·{" "}
                      {format.bestOf}판
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

interface StoredRoundsProps {
  rounds: StoredScheduleRound[];
}

function StoredRounds({ rounds }: StoredRoundsProps) {
  if (rounds.length === 0) {
    return <div className={styles.empty}>저장된 대진이 없습니다.</div>;
  }

  return (
    <div className={styles.roundList}>
      {rounds.map((round) => (
        <article key={round.round} className={styles.roundCard}>
          <header>
            <h3>{round.round}라운드</h3>

            {round.byeTeam && <span>휴식: {round.byeTeam.name}</span>}
          </header>

          <div className={styles.matchList}>
            {round.matches.map((match) => (
              <div key={match.id} className={styles.matchCard}>
                <div className={styles.teams}>
                  <strong>{match.homeTeam.name}</strong>

                  <span>VS</span>

                  <strong>{match.awayTeam.name}</strong>
                </div>

                <div className={styles.formatList}>
                  {match.games.map((game) => (
                    <span key={game.id}>
                      {game.sequence}. {getMatchTypeLabel(game.matchType)} ·{" "}
                      {game.bestOf}판
                    </span>
                  ))}
                </div>

                <div className={styles.lineupStatus}>
                  <span>
                    {match.homeTeam.name}:{" "}
                    {getLineupLabel(match.homeLineupStatus)}
                  </span>

                  <span>
                    {match.awayTeam.name}:{" "}
                    {getLineupLabel(match.awayLineupStatus)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
