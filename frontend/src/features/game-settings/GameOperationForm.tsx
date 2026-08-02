import type { SubmitEvent } from "react";
import { Save, Users, UserRound } from "lucide-react";

import { COMPETITION_TYPE_LABELS, type GameSettingInput } from "./types";

import styles from "./GameSettings.module.css";

interface Props {
  formData: GameSettingInput;
  isConfirmed: boolean;
  isWorking: boolean;
  hasSetting: boolean;
  hasUnsavedChanges: boolean;
  onChange: (formData: GameSettingInput) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  onUnlock: () => void;
}

export default function GameOperationForm({
  formData,
  isConfirmed,
  isWorking,
  hasSetting,
  hasUnsavedChanges,
  onChange,
  onSubmit,
  onUnlock,
}: Props) {
  const isDisabled = isWorking || isConfirmed;

  return (
    <form
      className={`${styles.section} ${styles.operationSection} ${
        formData.competitionType === "team_league"
          ? styles.teamOperationSection
          : ""
      }`}
      onSubmit={onSubmit}
    >
      <header className={styles.sectionHeader}>
        <h2>게임 운영 방식</h2>
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
            disabled={isDisabled}
            onChange={() =>
              onChange({
                ...formData,
                competitionType: "team_league",
              })
            }
          />

          <Users size={22} aria-hidden="true" />

          <span className={styles.modeContent}>
            <strong className={styles.desktopModeLabel}>
              {COMPETITION_TYPE_LABELS.team_league}
            </strong>
            <strong className={styles.mobileModeLabel}>팀 리그전</strong>
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
            disabled={isDisabled}
            onChange={() =>
              onChange({
                ...formData,
                competitionType: "individual_singles",
              })
            }
          />

          <UserRound size={22} aria-hidden="true" />

          <span className={styles.modeContent}>
            <strong className={styles.desktopModeLabel}>
              {COMPETITION_TYPE_LABELS.individual_singles}
            </strong>
            <strong className={styles.mobileModeLabel}>개인 단식</strong>
          </span>
        </label>
      </div>

      <div
        className={
          formData.competitionType === "team_league"
            ? styles.teamOperationRow
            : styles.operationControls
        }
      >
        <div
          className={
            formData.competitionType === "team_league"
              ? styles.teamFormGrid
              : styles.formGrid
          }
        >
          {formData.competitionType === "team_league" ? (
            <>
              <label className={styles.formField}>
                <span>팀원</span>

                <input
                  type="number"
                  min={1}
                  value={formData.teamSize}
                  disabled={isDisabled}
                  onChange={(event) =>
                    onChange({
                      ...formData,
                      teamSize: Number(event.target.value),
                    })
                  }
                />
              </label>

              <label className={styles.formField}>
                <span>균형 팀 편성</span>

                <span className={styles.checkboxField}>
                  <input
                    type="checkbox"
                    aria-label="팀 편성"
                    checked={formData.autoTeamBalance}
                    disabled={isDisabled}
                    onChange={(event) =>
                      onChange({
                        ...formData,
                        autoTeamBalance: event.target.checked,
                      })
                    }
                  />
                </span>
              </label>
            </>
          ) : (
            <>
              <label className={styles.formField}>
                <span>테이블</span>

                <input
                  type="number"
                  min={1}
                  max={30}
                  value={formData.individualTableCount}
                  disabled={isDisabled}
                  onChange={(event) =>
                    onChange({
                      ...formData,
                      individualTableCount: Number(event.target.value),
                    })
                  }
                />
              </label>

              <label className={styles.formField}>
                <span>세트</span>

                <input
                  type="number"
                  min={1}
                  step={2}
                  value={formData.individualBestOf}
                  disabled={isDisabled}
                  onChange={(event) =>
                    onChange({
                      ...formData,
                      individualBestOf: Number(event.target.value),
                    })
                  }
                />
              </label>

              <label className={styles.formField}>
                <span>승강</span>

                <span className={styles.checkboxField}>
                  <input
                    type="checkbox"
                    aria-label="승강 반영"
                    checked={formData.individualCountsForRanking}
                    disabled={isDisabled}
                    onChange={(event) =>
                      onChange({
                        ...formData,
                        individualCountsForRanking: event.target.checked,
                      })
                    }
                  />
                </span>
              </label>
            </>
          )}
        </div>

        <div
          className={
            formData.competitionType === "team_league"
              ? styles.teamFormActions
              : styles.formActions
          }
        >
          {isConfirmed ? (
            <button
              type="button"
              className={styles.dangerButton}
              disabled={isWorking}
              onClick={onUnlock}
            >
              설정 수정
            </button>
          ) : (
            <button
              type="submit"
              className={styles.secondaryButton}
              disabled={isWorking || (hasSetting && !hasUnsavedChanges)}
            >
              <Save size={18} aria-hidden="true" />
              {isWorking ? "저장 중…" : "저장"}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
