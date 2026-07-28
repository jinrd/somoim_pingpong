import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCcw, Save, Trash2 } from "lucide-react";
import type { EventGameSetting } from "../game-settings/types";
import {
  type IndividualScheduleContext,
  type StoredIndividualScheduleRound,
  deleteSchedule,
  getIndividualSchedule,
  saveIndividualSchedule,
} from "./api";
import {
  type RoundRobinSchedule,
  generateRoundRobin,
} from "./generateRoundRobin";
import styles from "./TeamSchedulePanel.module.css";
import { ClientResponseError } from "pocketbase";

interface Props {
  setting: EventGameSetting | null;
  onScheduleChanged?: (hasSchedule: boolean) => void;
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

const shuffleParticipants = <T extends { sortOrder: number }>(
  array: T[],
): T[] => {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  /*
   * generateRoundRobin은 sortOrder 순으로 팀을 다시 정렬하므로
   * 섞인 순서에 맞춰 임시 sortOrder를 새로 지정합니다.
   */
  return result.map((participant, index) => ({
    ...participant,
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

export default function IndividualSchedulePanel({
  setting,
  onScheduleChanged,
}: Props) {
  const [context, setContext] = useState<IndividualScheduleContext | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [preview, setPreview] = useState<RoundRobinSchedule | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const applyLoadedSchedule = useCallback(
    (loadedContext: IndividualScheduleContext) => {
      setContext(loadedContext);
      onScheduleChanged?.(loadedContext.totalMatchCount > 0);
      setPreview(null);
      setError("");

      if (loadedContext.participants.length < 2) {
        setError("게임 참가(playing) 상태인 인원이 최소 2명 필요합니다.");
        return;
      }

      if (loadedContext.totalMatchCount === 0) {
        setMessage("등록된 대진표가 없습니다. [대진표 재생성]을 눌러 주세요.");
      } else {
        setMessage("");
      }
    },
    [onScheduleChanged],
  );

  useEffect(() => {
    if (!setting || setting.competition_type !== "individual_singles") {
      return;
    }

    let cancelled = false;

    getIndividualSchedule(setting.id)
      .then((loadedContext) => {
        if (!cancelled) {
          applyLoadedSchedule(loadedContext);
        }
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
    if (!context) return;
    try {
      if (context.participants.length < 2) {
        setError("게임 참가 인원이 최소 2명 필요합니다.");
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
          shuffleParticipants(context.participants),
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
    if (!setting || !context || !preview) return;

    if (
      context.totalMatchCount > 0 &&
      !window.confirm("기존 대진을 삭제하고 다시 생성할까요?")
    ) {
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const result = await saveIndividualSchedule(setting.id, {
        expectedScheduleVersion: context.scheduleVersion,
        schedule: preview,
      });
      setMessage(
        `${result.totalRoundCount}라운드, ${result.totalMatchCount}경기를 저장했습니다.`,
      );
      onScheduleChanged?.(result.totalMatchCount > 0);
      void getIndividualSchedule(setting.id)
        .then(applyLoadedSchedule)
        .catch(() => {});
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "대진을 저장하지 못했습니다."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSchedule = async () => {
    if (!setting || !context) return;

    if (!window.confirm("저장된 개인 단식 대진표를 모두 삭제할까요?")) {
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      await deleteSchedule(setting.id);

      setMessage("대진표가 완전히 삭제되었습니다.");
      setContext(null);
      onScheduleChanged?.(false);

      window.dispatchEvent(new Event("scheduleDeleted"));

      void getIndividualSchedule(setting.id)
        .then(applyLoadedSchedule)
        .catch(() => {});
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "대진을 삭제하지 못했습니다."));
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

  if (setting.competition_type !== "individual_singles") {
    return (
      <section className={styles.panel}>
        <h2>단식 풀리그 대진표</h2>
        <p>게임 설정이 '개인 단식 풀리그'가 아닙니다.</p>
      </section>
    );
  }

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <h2>단식 풀리그 대진표</h2>
        <div className={styles.actions}>
          {(!context ||
            context.totalMatchCount === 0 ||
            context.canRegenerate) && (
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handleGeneratePreview}
              disabled={isLoading || isSaving}
            >
              <RefreshCcw size={16} aria-hidden="true" />

              {context?.totalMatchCount === 0
                ? "대진표 최초 생성"
                : "대진표 재생성"}
            </button>
          )}
          {context &&
            context.totalMatchCount > 0 &&
            context.canRegenerate &&
            !preview && (
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={handleDeleteSchedule}
                disabled={isLoading || isSaving}
              >
                <Trash2 size={16} aria-hidden="true" />
                대진표 삭제 (초기화)
              </button>
            )}
          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleSave}
            disabled={!preview || isLoading || isSaving}
          >
            {isSaving ? (
              <Loader2
                size={16}
                className={styles.spinner}
                aria-hidden="true"
              />
            ) : (
              <Save size={16} aria-hidden="true" />
            )}
            저장
          </button>
        </div>
      </header>

      {error && <div className={styles.errorMessage}>{error}</div>}
      {message && <div className={styles.successMessage}>{message}</div>}

      {isLoading ? (
        <div className={styles.loadingState}>
          <Loader2 size={24} className={styles.spinner} aria-hidden="true" />
          <p>대진표를 불러오는 중입니다…</p>
        </div>
      ) : preview ? (
        <PreviewRounds schedule={preview} />
      ) : context && context.totalMatchCount > 0 ? (
        <StoredRounds rounds={context.rounds} />
      ) : (
        <div className={styles.emptyState}>
          <p>아직 저장된 대진표가 없습니다.</p>
          <p>[대진표 생성] 버튼을 눌러 미리보기를 확인해 주세요.</p>
        </div>
      )}
    </section>
  );
}

function PreviewRounds({ schedule }: { schedule: RoundRobinSchedule }) {
  return (
    <div className={styles.roundList}>
      {schedule.rounds.map((round) => (
        <article
          key={`preview-round-${round.round}`}
          className={styles.roundCard}
        >
          <header>
            <h3>라운드 {round.round}</h3>
            {round.byeTeam && <span>(휴식: {round.byeTeam.name})</span>}
          </header>
          <div className={styles.matchList}>
            {round.matches.map((match) => (
              <div key={match.key} className={styles.matchCard}>
                <div className={styles.teams}>
                  <strong>{match.homeTeamName}</strong>
                  <span>vs</span>
                  <strong>{match.awayTeamName}</strong>
                </div>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

function StoredRounds({ rounds }: { rounds: StoredIndividualScheduleRound[] }) {
  return (
    <div className={styles.roundList}>
      {rounds.map((round) => (
        <article
          key={`stored-round-${round.round}`}
          className={styles.roundCard}
        >
          <header>
            <h3>라운드 {round.round}</h3>
            {round.byeParticipant && (
              <span>(휴식: {round.byeParticipant.name})</span>
            )}
          </header>
          <div className={styles.matchList}>
            {round.matches.map((match) => (
              <div key={match.id} className={styles.matchCard}>
                <div className={styles.teams}>
                  <strong>{match.homeParticipant.name}</strong>
                  <span>vs</span>
                  <strong>{match.awayParticipant.name}</strong>
                </div>
                <div className={styles.formatList}>
                  <span>단식 ({match.bestOf}판)</span>
                </div>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
