import { useEffect, useState } from "react";

import {
  CheckCircle2,
  RefreshCw,
  Save,
  ShieldCheck,
  Users,
} from "lucide-react";

import { ClientResponseError } from "pocketbase";

import {
  getMyTeamMatches,
  getPublicLineupContext,
  savePublicLineup,
} from "./api";

import {
  createLineupSelections,
  isLineupComplete,
  toggleLineupParticipant,
  type LineupSelections,
} from "./selection";

import type {
  PublicLineupContext,
  PublicLineupStatus,
  PublicParticipantMatchesResponse,
} from "./types";

import styles from "./PublicLineupSection.module.css";

interface Props {
  responseToken: string;
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

const getLineupStatusLabel = (status: PublicLineupStatus): string => {
  return status === "confirmed" ? "확정" : "작성 중";
};

const getMatchTypeLabel = (matchType: "singles" | "doubles"): string => {
  return matchType === "singles" ? "단식" : "복식";
};

export default function PublicLineupSection({ responseToken }: Props) {
  const [matchResponse, setMatchResponse] =
    useState<PublicParticipantMatchesResponse | null>(null);

  const [context, setContext] = useState<PublicLineupContext | null>(null);

  const [selections, setSelections] = useState<LineupSelections>({});

  const [isLoading, setIsLoading] = useState(true);
  const [isOpening, setIsOpening] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    getMyTeamMatches(responseToken)
      .then((result) => {
        if (!cancelled) {
          setMatchResponse(result);
          setError("");
        }
      })
      .catch((caughtError) => {
        if (!cancelled) {
          setError(
            getErrorMessage(caughtError, "내 경기 목록을 불러오지 못했습니다."),
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
  }, [responseToken]);

  const reloadMatches = async () => {
    setIsLoading(true);
    setError("");

    try {
      const result = await getMyTeamMatches(responseToken);

      setMatchResponse(result);
    } catch (caughtError) {
      setError(
        getErrorMessage(caughtError, "내 경기 목록을 불러오지 못했습니다."),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const openMatch = async (teamMatchId: string) => {
    setIsOpening(true);
    setError("");
    setMessage("");

    try {
      const result = await getPublicLineupContext(teamMatchId, responseToken);

      setContext(result);
      setSelections(createLineupSelections(result));
    } catch (caughtError) {
      setError(
        getErrorMessage(caughtError, "라인업 정보를 불러오지 못했습니다."),
      );
    } finally {
      setIsOpening(false);
    }
  };

  const handleParticipantToggle = (
    matchGameId: string,
    participantId: string,
    requiredPlayerCount: number,
  ) => {
    setSelections((current) => ({
      ...current,

      [matchGameId]: toggleLineupParticipant(
        current[matchGameId] ?? [],
        participantId,
        requiredPlayerCount,
      ),
    }));

    setError("");
    setMessage("");
  };

  const handleSave = async (status: PublicLineupStatus) => {
    if (!context) {
      return;
    }

    if (
      status === "confirmed" &&
      !isLineupComplete(context.games, selections)
    ) {
      setError("모든 단식·복식 경기의 출전 선수를 선택해 주세요.");
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const result = await savePublicLineup(context.match.id, {
        responseToken,
        expectedVersion: context.lineup.version,
        status,

        games: context.games.map((game) => ({
          matchGameId: game.id,
          participantIds: selections[game.id] ?? [],
        })),
      });

      setContext(result);
      setSelections(createLineupSelections(result));

      const updatedMatches = await getMyTeamMatches(responseToken);

      setMatchResponse(updatedMatches);

      setMessage(
        status === "confirmed"
          ? "라인업을 확정했습니다."
          : "라인업을 임시 저장했습니다.",
      );
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "라인업을 저장하지 못했습니다."));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <section className={styles.section}>
        내 경기와 라인업을 불러오는 중입니다…
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <div>
          <h2>내 팀 경기와 라인업</h2>

          <p>
            같은 팀 참가자는 경기마다 출전 순서를 작성하고 확정할 수 있습니다.
          </p>
        </div>

        <button
          type="button"
          className={styles.iconButton}
          disabled={isLoading || isSaving}
          onClick={() => {
            void reloadMatches();
          }}
          aria-label="내 경기 새로고침"
        >
          <RefreshCw size={18} aria-hidden="true" />
        </button>
      </header>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {message && (
        <p className={styles.success} role="status">
          <CheckCircle2 size={17} aria-hidden="true" />
          {message}
        </p>
      )}

      {!matchResponse?.team ? (
        <p className={styles.empty}>아직 확정된 팀 편성이나 대진이 없습니다.</p>
      ) : (
        <>
          <div className={styles.teamSummary}>
            <Users size={19} aria-hidden="true" />

            <span>내 팀</span>
            <strong>{matchResponse.team.name}</strong>
          </div>

          {matchResponse.matches.length === 0 ? (
            <p className={styles.empty}>아직 저장된 팀 경기가 없습니다.</p>
          ) : (
            <div className={styles.matchList}>
              {matchResponse.matches.map((match) => (
                <button
                  key={match.id}
                  type="button"
                  className={
                    context?.match.id === match.id
                      ? styles.matchButtonActive
                      : styles.matchButton
                  }
                  disabled={isOpening || isSaving}
                  onClick={() => {
                    void openMatch(match.id);
                  }}
                >
                  <span>
                    {match.round}라운드 · {match.sortOrder}번째 경기
                  </span>

                  <strong>
                    {matchResponse.team?.name} VS {match.opponentTeam.name}
                  </strong>

                  <small>
                    우리 팀 라인업:{" "}
                    {getLineupStatusLabel(match.ownLineupStatus)}
                  </small>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {isOpening && <p className={styles.empty}>라인업을 불러오는 중입니다…</p>}

      {context && !isOpening && (
        <div className={styles.editor}>
          <header className={styles.editorHeader}>
            <div>
              <span>{context.match.round}라운드</span>

              <h3>
                {context.team.name} VS {context.opponentTeam.name}
              </h3>
            </div>

            <span className={styles.lineupStatus}>
              {getLineupStatusLabel(context.lineup.status)}
            </span>
          </header>

          <div className={styles.gameList}>
            {context.games.map((game) => {
              const selectedIds = selections[game.id] ?? [];

              return (
                <article key={game.id} className={styles.gameCard}>
                  <header>
                    <div>
                      <strong>
                        {game.sequence}. {getMatchTypeLabel(game.matchType)}
                      </strong>

                      <span>
                        {game.bestOf}판 · {selectedIds.length}/
                        {game.requiredPlayerCount}명
                      </span>
                    </div>
                  </header>

                  <div className={styles.memberGrid}>
                    {context.members.map((member) => {
                      const selected = selectedIds.includes(
                        member.participantId,
                      );

                      return (
                        <button
                          key={member.participantId}
                          type="button"
                          className={
                            selected
                              ? styles.memberSelected
                              : styles.memberButton
                          }
                          disabled={isSaving}
                          onClick={() => {
                            handleParticipantToggle(
                              game.id,
                              member.participantId,
                              game.requiredPlayerCount,
                            );
                          }}
                        >
                          <span>
                            {member.displayName}
                            {member.isRequester ? " (나)" : ""}
                          </span>

                          <small>{member.rankSnapshot}부</small>
                        </button>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.draftButton}
              disabled={isSaving}
              onClick={() => {
                void handleSave("draft");
              }}
            >
              <Save size={17} aria-hidden="true" />

              {isSaving ? "저장 중…" : "임시 저장"}
            </button>

            <button
              type="button"
              className={styles.confirmButton}
              disabled={
                isSaving || !isLineupComplete(context.games, selections)
              }
              onClick={() => {
                void handleSave("confirmed");
              }}
            >
              <ShieldCheck size={17} aria-hidden="true" />
              라인업 확정
            </button>
          </div>

          {context.lineup.confirmedBy && (
            <p className={styles.confirmedBy}>
              마지막 확정: {context.lineup.confirmedBy.displayName}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
