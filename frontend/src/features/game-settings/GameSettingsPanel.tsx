import { useEffect, useState, type SubmitEvent } from "react";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Plus,
  Save,
  Trash2,
  Users,
  UserRound,
} from "lucide-react";

import {
  confirmEventGameSetting,
  getEventGameConfiguration,
  saveMatchFormats,
  saveEventGameSettingDraft,
  unlockEventGameSetting,
} from "./api";

import {
  DEFAULT_GAME_SETTING_INPUT,
  DEFAULT_MATCH_FORMAT_INPUT,
} from "./constants";

import {
  COMPETITION_TYPE_LABELS,
  MATCH_TYPE_LABELS,
  type EventGameSetting,
  type EventMatchFormat,
  type GameSettingInput,
  type MatchFormatDraft,
  type MatchFormatInput,
  type MatchType,
} from "./types";

import styles from "./GameSettings.module.css";

interface Props {
  eventId: string;
  participationStatus: "open" | "closed";
  onSettingChanged?: (setting: EventGameSetting | null) => void;
  onConfigurationReset?: () => void;
}

interface MatchFormatRowProps {
  format: MatchFormatDraft;
  position: number;
  disabled: boolean;
  onChange: (format: MatchFormatDraft) => void;
  onDeleted: (formatKey: string) => void;
}

const toGameSettingInput = (setting: EventGameSetting): GameSettingInput => ({
  competitionType: setting.competition_type,

  teamSize: setting.team_size,

  autoTeamBalance: setting.auto_team_balance,

  individualBestOf: setting.individual_best_of,

  individualCountsForRanking: setting.individual_counts_for_ranking,
});

const toMatchFormatDraft = (format: EventMatchFormat): MatchFormatDraft => ({
  key: format.id,
  id: format.id,
  matchType: format.match_type,
  bestOf: format.best_of,
  countsForRanking: format.counts_for_ranking,
});

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
};

function MatchFormatRow({
  format,
  position,
  disabled,
  onChange,
  onDeleted,
}: MatchFormatRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: format.key,
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      className={isDragging ? styles.sortableItemDragging : styles.sortableItem}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <div className={styles.formatRow}>
        <div className={styles.orderCell}>
          <button
            type="button"
            className={styles.dragHandle}
            disabled={disabled}
            aria-label={`${position}번째 경기 순서 이동`}
            {...attributes}
            {...listeners}
          >
            <GripVertical size={20} aria-hidden="true" />
          </button>

          <strong>{position}</strong>
          <span>번째</span>
        </div>

        <label className={styles.compactField}>
          <span>경기 방식</span>

          <select
            value={format.matchType}
            disabled={disabled}
            onChange={(event) => {
              onChange({
                ...format,
                matchType: event.target.value as MatchType,
              });
            }}
          >
            {Object.entries(MATCH_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.compactField}>
          <span>총 판수</span>

          <input
            type="number"
            min={1}
            step={2}
            value={format.bestOf}
            disabled={disabled}
            onChange={(event) => {
              onChange({
                ...format,
                bestOf: Number(event.target.value),
              });
            }}
          />
        </label>

        <label className={styles.formatCheckbox}>
          <input
            type="checkbox"
            checked={format.countsForRanking}
            disabled={disabled}
            onChange={(event) => {
              onChange({
                ...format,
                countsForRanking: event.target.checked,
              });
            }}
          />
          부수 승강 반영
        </label>

        <button
          type="button"
          className={styles.iconButton}
          disabled={disabled}
          aria-label={`${position}번 경기 삭제`}
          onClick={() => {
            if (window.confirm(`${position}번 경기를 목록에서 삭제할까요?`)) {
              onDeleted(format.key);
            }
          }}
        >
          <Trash2 size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default function GameSettingsPanel({
  eventId,
  participationStatus,
  onSettingChanged,
  onConfigurationReset,
}: Props) {
  const [setting, setSetting] = useState<EventGameSetting | null>(null);

  const [matchFormats, setMatchFormats] = useState<MatchFormatDraft[]>([]);

  const [formData, setFormData] = useState<GameSettingInput>(
    DEFAULT_GAME_SETTING_INPUT,
  );

  const [newFormat, setNewFormat] = useState<MatchFormatInput>(
    DEFAULT_MATCH_FORMAT_INPUT,
  );

  const [areFormatsDirty, setAreFormatsDirty] = useState(false);

  const [isLoading, setIsLoading] = useState(true);

  const [isWorking, setIsWorking] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isConfirmSettingOpen, setConfirmSettingOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  useEffect(() => {
    let cancelled = false;

    getEventGameConfiguration(eventId)
      .then((configuration) => {
        if (cancelled) {
          return;
        }

        setSetting(configuration.setting);
        onSettingChanged?.(configuration.setting);
        setMatchFormats(configuration.matchFormats.map(toMatchFormatDraft));
        setAreFormatsDirty(false);

        if (configuration.setting) {
          setFormData(toGameSettingInput(configuration.setting));
        }
      })
      .catch((caughtError) => {
        if (!cancelled) {
          setError(
            getErrorMessage(caughtError, "게임 설정을 불러오지 못했습니다."),
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
  }, [eventId, onSettingChanged]);

  const isConfirmed = setting?.status === "confirmed";
  const hasUnsavedSettingChanges =
    !setting ||
    formData.competitionType !== setting.competition_type ||
    formData.teamSize !== setting.team_size ||
    formData.autoTeamBalance !== setting.auto_team_balance ||
    formData.individualBestOf !== setting.individual_best_of ||
    formData.individualCountsForRanking !==
      setting.individual_counts_for_ranking;

  const canConfirmSetting =
    Boolean(setting) &&
    !hasUnsavedSettingChanges &&
    !areFormatsDirty &&
    (formData.competitionType === "individual_singles" ||
      matchFormats.length > 0);

  const handleSaveSetting = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (
      formData.competitionType === "team_league" &&
      formData.teamSize < 2 &&
      matchFormats.some((format) => format.matchType === "doubles")
    ) {
      setError("복식 경기가 있으므로 팀당 인원은 2명 이상이어야 합니다.");
      return;
    }

    setIsWorking(true);
    setError("");
    setMessage("");

    try {
      const savedSetting = await saveEventGameSettingDraft(
        eventId,
        formData,
        setting?.version ?? 0,
      );

      setSetting(savedSetting);
      onSettingChanged?.(savedSetting);
      setFormData(toGameSettingInput(savedSetting));

      if (
        savedSetting.competition_type === "individual_singles" ||
        (setting && savedSetting.id !== setting.id)
      ) {
        setMatchFormats([]);
        setAreFormatsDirty(false);
      }

      setMessage("게임 설정 초안을 저장했습니다.");
    } catch (caughtError) {
      setError(
        getErrorMessage(caughtError, "게임 설정을 저장하지 못했습니다."),
      );
    } finally {
      setIsWorking(false);
    }
  };

  const handleOpenConfirmSetting = () => {
    if (!setting) {
      setError("게임 설정 초안을 먼저 저장해 주세요.");
      return;
    }

    if (hasUnsavedSettingChanges) {
      setError(
        "변경한 게임 설정을 먼저 '게임 설정 임시 저장'으로 저장해 주세요.",
      );
      return;
    }

    if (
      formData.competitionType === "team_league" &&
      matchFormats.length === 0
    ) {
      setError("팀 대결 세부 경기를 한 개 이상 저장해 주세요.");
      return;
    }

    if (areFormatsDirty) {
      setError("변경한 세부 경기를 먼저 전체 저장해 주세요.");
      return;
    }

    if (
      formData.competitionType === "team_league" &&
      formData.teamSize < 2 &&
      matchFormats.some((format) => format.matchType === "doubles")
    ) {
      setError("복식 경기가 있으므로 팀당 인원은 2명 이상이어야 합니다.");
      return;
    }

    setError("");
    setMessage("");
    setConfirmSettingOpen(true);
  };

  const handleConfirmSetting = async () => {
    if (!setting) {
      setConfirmSettingOpen(false);
      setError("게임 설정 초안을 먼저 저장해 주세요.");
      return;
    }

    setConfirmSettingOpen(false);
    setIsWorking(true);
    setError("");
    setMessage("");

    try {
      const confirmedSetting = await confirmEventGameSetting(
        setting.id,
        setting.version,
      );

      setSetting(confirmedSetting);
      setFormData(toGameSettingInput(confirmedSetting));
      onSettingChanged?.(confirmedSetting);
      setMessage("게임 설정을 최종 확정했습니다.");
    } catch (caughtError) {
      setError(
        getErrorMessage(caughtError, "게임 설정을 확정하지 못했습니다."),
      );
    } finally {
      setIsWorking(false);
    }
  };

  const handleUnlockSetting = async () => {
    if (!setting || setting.status !== "confirmed") {
      return;
    }

    if (
      !window.confirm(
        "게임 설정 수정을 시작할까요?\n\n세부 경기, 팀 편성, 대진표와 라인업이 모두 초기화되며 되돌릴 수 없습니다. 현재 기본 설정은 새 초안으로 유지됩니다.",
      )
    ) {
      return;
    }

    setIsWorking(true);
    setError("");
    setMessage("");

    try {
      const draftSetting = await unlockEventGameSetting(
        setting.id,
        setting.version,
      );

      setSetting(draftSetting);
      setFormData(toGameSettingInput(draftSetting));
      setMatchFormats([]);
      setAreFormatsDirty(false);
      onSettingChanged?.(draftSetting);
      onConfigurationReset?.();
      setMessage("기존 경기 구성을 초기화하고 게임 설정을 초안으로 전환했습니다.");
    } catch (caughtError) {
      setError(
        getErrorMessage(caughtError, "게임 설정 수정을 시작하지 못했습니다."),
      );
    } finally {
      setIsWorking(false);
    }
  };

  const handleAddFormat = () => {
    if (!setting) {
      setError("먼저 회차 게임 설정을 저장해 주세요.");
      return;
    }

    if (newFormat.matchType === "doubles" && formData.teamSize < 2) {
      setError("복식 경기를 추가하려면 팀당 인원이 2명 이상이어야 합니다.");
      return;
    }

    setError("");
    setMessage("");

    setMatchFormats((currentFormats) => [
      ...currentFormats,
      {
        key: crypto.randomUUID(),
        ...newFormat,
      },
    ]);
    setNewFormat(DEFAULT_MATCH_FORMAT_INPUT);
    setAreFormatsDirty(true);
    setMessage("경기를 목록에 추가했습니다. 전체 저장을 눌러 반영해 주세요.");
  };

  const handleSaveFormats = async () => {
    if (!setting) {
      setError("먼저 회차 게임 설정을 저장해 주세요.");
      return;
    }

    if (
      formData.teamSize < 2 &&
      matchFormats.some((format) => format.matchType === "doubles")
    ) {
      setError("복식 경기가 있으므로 팀당 인원은 2명 이상이어야 합니다.");
      return;
    }

    setIsWorking(true);
    setError("");
    setMessage("");

    try {
      const savedFormats = await saveMatchFormats(
        setting.id,
        matchFormats.map(({ id, matchType, bestOf, countsForRanking }) => ({
          id,
          matchType,
          bestOf,
          countsForRanking,
        })),
      );

      setMatchFormats(savedFormats.map(toMatchFormatDraft));
      setAreFormatsDirty(false);
      setMessage("세부 경기 전체를 저장했습니다.");
    } catch (caughtError) {
      setError(
        getErrorMessage(caughtError, "세부 경기 전체를 저장하지 못했습니다."),
      );
    } finally {
      setIsWorking(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || isWorking) {
      return;
    }

    const previousFormats = matchFormats;
    const oldIndex = previousFormats.findIndex(
      (format) => format.key === active.id,
    );
    const newIndex = previousFormats.findIndex(
      (format) => format.key === over.id,
    );

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const movedFormats = arrayMove(previousFormats, oldIndex, newIndex);

    setMatchFormats(movedFormats);
    setAreFormatsDirty(true);
    setError("");
    setMessage("경기 순서를 변경했습니다. 전체 저장을 눌러 반영해 주세요.");
  };

  const handleDeleteFormat = (formatKey: string) => {
    setError("");
    setMatchFormats((currentFormats) =>
      currentFormats.filter((format) => format.key !== formatKey),
    );
    setAreFormatsDirty(true);
    setMessage("경기를 목록에서 삭제했습니다. 전체 저장을 눌러 반영해 주세요.");
  };

  if (isLoading) {
    return <div className={styles.loading}>게임 설정을 불러오는 중입니다…</div>;
  }

  if (participationStatus !== "closed") {
    return (
      <section className={styles.panel}>
        <div className={styles.notice}>
          <strong>참가 신청 마감 후 게임 설정을 시작할 수 있습니다.</strong>
          <p>
            참석자 관리에서 미정 상태를 모두 확정하고 참가 신청 최종 마감을
            진행해 주세요.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.panel}>
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

      <form className={styles.section} onSubmit={handleSaveSetting}>
        <header className={styles.sectionHeader}>
          <div>
            <h2>게임 운영 방식</h2>

            <p>
              이번 회차의 참가 인원과 운영 방식에 맞는 게임 유형을 선택하세요.
            </p>
          </div>
        </header>

        <div className={styles.modeGrid}>
          <label
            className={
              formData.competitionType === "team_league"
                ? styles.modeOptionSelected
                : styles.modeOption
            }
          >
            <input
              type="radio"
              name="competition-type"
              value="team_league"
              checked={formData.competitionType === "team_league"}
              disabled={isWorking || isConfirmed}
              onChange={() => {
                setFormData((current) => ({
                  ...current,
                  competitionType: "team_league",
                }));
              }}
            />

            <Users size={22} aria-hidden="true" />

            <span className={styles.modeContent}>
              <strong>{COMPETITION_TYPE_LABELS.team_league}</strong>

              <small>팀을 편성하고 팀별 풀리그를 진행합니다.</small>
            </span>
          </label>

          <label
            className={
              formData.competitionType === "individual_singles"
                ? styles.modeOptionSelected
                : styles.modeOption
            }
          >
            <input
              type="radio"
              name="competition-type"
              value="individual_singles"
              checked={formData.competitionType === "individual_singles"}
              disabled={isWorking || isConfirmed}
              onChange={() => {
                setFormData((current) => ({
                  ...current,
                  competitionType: "individual_singles",
                }));
              }}
            />

            <UserRound size={22} aria-hidden="true" />

            <span className={styles.modeContent}>
              <strong>{COMPETITION_TYPE_LABELS.individual_singles}</strong>

              <small>게임 참가자 전체가 단식 풀리그를 진행합니다.</small>
            </span>
          </label>
        </div>

        <div className={styles.formGrid}>
          {formData.competitionType === "team_league" ? (
            <>
              <label className={styles.formField}>
                <span>팀당 인원</span>

                <input
                  type="number"
                  min={1}
                  value={formData.teamSize}
                  disabled={isWorking || isConfirmed}
                  onChange={(event) => {
                    setFormData((current) => ({
                      ...current,
                      teamSize: Number(event.target.value),
                    }));
                  }}
                />

                <p className={styles.fieldHint}>
                  전체 인원이 나누어떨어지지 않아도 이후 편성 화면에서 조정할 수
                  있습니다.
                </p>
              </label>

              <label className={styles.formField}>
                <span>팀 자동 편성</span>

                <span className={styles.checkboxField}>
                  <input
                    type="checkbox"
                    checked={formData.autoTeamBalance}
                    disabled={isWorking || isConfirmed}
                    onChange={(event) => {
                      setFormData((current) => ({
                        ...current,
                        autoTeamBalance: event.target.checked,
                      }));
                    }}
                  />
                  부수를 기준으로 팀 전력을 맞춤
                </span>
              </label>
            </>
          ) : (
            <>
              <label className={styles.formField}>
                <span>경기 총 판수</span>

                <input
                  type="number"
                  min={1}
                  step={2}
                  value={formData.individualBestOf}
                  disabled={isWorking || isConfirmed}
                  onChange={(event) => {
                    setFormData((current) => ({
                      ...current,
                      individualBestOf: Number(event.target.value),
                    }));
                  }}
                />

                <p className={styles.fieldHint}>
                  3은 3판 2선승, 5는 5판 3선승입니다.
                </p>
              </label>

              <label className={styles.formField}>
                <span>부수 승강</span>

                <span className={styles.checkboxField}>
                  <input
                    type="checkbox"
                    checked={formData.individualCountsForRanking}
                    disabled={isWorking || isConfirmed}
                    onChange={(event) => {
                      setFormData((current) => ({
                        ...current,
                        individualCountsForRanking: event.target.checked,
                      }));
                    }}
                  />
                  개인 단식 결과를 부수 승강에 반영
                </span>
              </label>
            </>
          )}

        </div>

        <div className={styles.formActions}>
          {isConfirmed ? (
            <button
              type="button"
              className={styles.dangerButton}
              disabled={isWorking}
              onClick={() => void handleUnlockSetting()}
            >
              게임 설정 수정
            </button>
          ) : (
            <>
              <button
                type="submit"
                className={styles.secondaryButton}
                disabled={
                  isWorking || (Boolean(setting) && !hasUnsavedSettingChanges)
                }
              >
                <Save size={18} aria-hidden="true" />
                {isWorking ? "저장 중…" : "게임 설정 임시 저장"}
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                disabled={isWorking || !canConfirmSetting}
                title={
                  canConfirmSetting
                    ? undefined
                    : hasUnsavedSettingChanges
                      ? "변경한 게임 설정을 먼저 임시 저장해 주세요."
                      : areFormatsDirty
                        ? "변경한 세부 경기를 먼저 전체 저장해 주세요."
                        : formData.competitionType === "team_league" &&
                            matchFormats.length === 0
                          ? "팀 대결 세부 경기를 한 개 이상 저장해 주세요."
                          : "게임 설정을 먼저 임시 저장해 주세요."
                }
                onClick={handleOpenConfirmSetting}
              >
                게임 설정 최종 확정
              </button>
            </>
          )}
        </div>
      </form>

      {formData.competitionType === "team_league" && (
        <section className={styles.section}>
          <header className={styles.sectionHeader}>
            <div>
              <h2>팀 대결 세부 경기</h2>

              <p>경기 수와 단식·복식 순서를 자유롭게 설정할 수 있습니다.</p>
            </div>
          </header>

          {!setting ? (
            <p className={styles.notice}>
              세부 경기를 추가하려면 먼저 게임 설정을 저장해 주세요.
            </p>
          ) : (
            <>
              {matchFormats.length === 0 ? (
                <p className={styles.emptyFormats}>
                  등록된 세부 경기가 없습니다.
                </p>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={matchFormats.map((format) => format.key)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className={styles.formatList}>
                      {matchFormats.map((format, index) => (
                        <MatchFormatRow
                          key={format.key}
                          format={format}
                          position={index + 1}
                          disabled={isWorking || isConfirmed}
                          onChange={(updatedFormat) => {
                            setMatchFormats((currentFormats) =>
                              currentFormats.map((current) =>
                                current.key === updatedFormat.key
                                  ? updatedFormat
                                  : current,
                              ),
                            );
                            setAreFormatsDirty(true);
                            setMessage(
                              "세부 경기를 변경했습니다. 전체 저장을 눌러 반영해 주세요.",
                            );
                          }}
                          onDeleted={handleDeleteFormat}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}

              {!isConfirmed && (
                <div className={styles.newFormatRow}>
                  <div className={styles.newFormatOrder}>
                    <strong>{matchFormats.length + 1}</strong>
                    <span>번째 경기 추가</span>
                  </div>

                  <label className={styles.compactField}>
                    <span>경기 방식</span>

                    <select
                      value={newFormat.matchType}
                      disabled={isWorking}
                      onChange={(event) => {
                        setNewFormat((current) => ({
                          ...current,
                          matchType: event.target.value as MatchType,
                        }));
                      }}
                    >
                      {Object.entries(MATCH_TYPE_LABELS).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <label className={styles.compactField}>
                    <span>총 판수</span>

                    <input
                      type="number"
                      min={1}
                      step={2}
                      value={newFormat.bestOf}
                      disabled={isWorking}
                      onChange={(event) => {
                        setNewFormat((current) => ({
                          ...current,
                          bestOf: Number(event.target.value),
                        }));
                      }}
                    />
                  </label>

                  <label className={styles.formatCheckbox}>
                    <input
                      type="checkbox"
                      checked={newFormat.countsForRanking}
                      disabled={isWorking}
                      onChange={(event) => {
                        setNewFormat((current) => ({
                          ...current,
                          countsForRanking: event.target.checked,
                        }));
                      }}
                    />
                    부수 승강 반영
                  </label>

                  <button
                    type="button"
                    className={styles.primaryButton}
                    disabled={isWorking}
                    onClick={handleAddFormat}
                  >
                    <Plus size={18} aria-hidden="true" />
                    경기 추가
                  </button>
                </div>
              )}

              {!isConfirmed && <div className={styles.formatSaveBar}>
                {areFormatsDirty && (
                  <span>저장하지 않은 변경 사항이 있습니다.</span>
                )}

                <button
                  type="button"
                  className={styles.primaryButton}
                  disabled={isWorking || !areFormatsDirty}
                  onClick={() => {
                    void handleSaveFormats();
                  }}
                >
                  <Save size={18} aria-hidden="true" />
                  {isWorking ? "저장 중…" : "세부 경기 전체 저장"}
                </button>
              </div>}
            </>
          )}
        </section>
      )}

      {isConfirmSettingOpen && (
        <div className={styles.confirmOverlay}>
          <section
            className={styles.confirmDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-game-setting-title"
            aria-describedby="confirm-game-setting-description"
          >
            <h2 id="confirm-game-setting-title">
              게임 설정을 최종 확정할까요?
            </h2>

            <p id="confirm-game-setting-description">
              현재 저장된 게임 설정과 세부 경기 구성을 최종 확정합니다.
            </p>

            <p>
              확정 후 수정하려면 팀 편성, 대진표와 라인업을 포함한 기존 경기
              구성이 모두 초기화됩니다.
            </p>

            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={isWorking}
                onClick={() => setConfirmSettingOpen(false)}
              >
                취소
              </button>

              <button
                type="button"
                className={styles.confirmSettingButton}
                disabled={isWorking}
                onClick={() => void handleConfirmSetting()}
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
