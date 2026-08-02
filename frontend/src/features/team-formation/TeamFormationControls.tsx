import { RotateCcw, Shuffle } from "lucide-react";

import { TEAM_FORMATION_METHOD_LABELS } from "./constants";
import type { TeamFormationMethod } from "./types";

import styles from "./TeamFormationPanel.module.css";

interface Props {
  method: TeamFormationMethod;
  isWorking: boolean;
  isConfirmed: boolean;
  participantCount: number;
  canUndo: boolean;
  onMethodChange: (method: TeamFormationMethod) => void;
  onGenerate: () => void;
  onUndo: () => void;
}

export default function TeamFormationControls({
  method,
  isWorking,
  isConfirmed,
  participantCount,
  canUndo,
  onMethodChange,
  onGenerate,
  onUndo,
}: Props) {
  const isEditingDisabled = isWorking || isConfirmed;

  return (
    <div className={styles.controls}>
      <label>
        <span>팀 편성 방식</span>

        <select
          value={method}
          disabled={isEditingDisabled}
          onChange={(event) =>
            onMethodChange(event.target.value as TeamFormationMethod)
          }
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
        disabled={isEditingDisabled || participantCount === 0}
        onClick={onGenerate}
      >
        <Shuffle size={18} aria-hidden="true" />팀 편성
      </button>

      <button
        type="button"
        className={styles.secondaryButton}
        disabled={isEditingDisabled || !canUndo}
        onClick={onUndo}
      >
        <RotateCcw size={18} aria-hidden="true" />
        되돌리기
      </button>
    </div>
  );
}
