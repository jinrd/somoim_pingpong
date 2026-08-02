import { Plus } from "lucide-react";

import {
  MATCH_TYPE_LABELS,
  type MatchFormatInput,
  type MatchType,
} from "./types";

import styles from "./GameSettings.module.css";

interface Props {
  format: MatchFormatInput;
  position: number;
  disabled: boolean;
  onChange: (format: MatchFormatInput) => void;
  onAdd: () => void;
}

export default function GameMatchFormatForm({
  format,
  position,
  disabled,
  onChange,
  onAdd,
}: Props) {
  return (
    <div className={styles.newFormatRow}>
      <div className={styles.newFormatOrder}>
        <strong>{position}</strong>
        <span>번 추가</span>
      </div>

      <label className={styles.compactField}>
        {/* <span>경기 방식</span> */}

        <select
          value={format.matchType}
          disabled={disabled}
          aria-label="추가할 경기 방식"
          onChange={(event) =>
            onChange({
              ...format,
              matchType: event.target.value as MatchType,
            })
          }
        >
          {Object.entries(MATCH_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.compactField}>
        {/* <span>총 판수</span> */}

        <div className={styles.inputWithUnit}>
          <input
            type="number"
            min={1}
            step={2}
            value={format.bestOf}
            disabled={disabled}
            aria-label="추가할 경기 총 세트 수"
            onChange={(event) =>
              onChange({
                ...format,
                bestOf: Number(event.target.value),
              })
            }
          />

          <span className={styles.unitText}>세트</span>
        </div>
      </label>

      <label className={styles.formatCheckbox}>
        <input
          type="checkbox"
          checked={format.countsForRanking}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              ...format,
              countsForRanking: event.target.checked,
            })
          }
        />

        {/* <span>부수 승강 반영</span> */}
      </label>

      <button
        type="button"
        className={styles.primaryButton}
        disabled={disabled}
        aria-label="세부 경기 추가"
        onClick={onAdd}
      >
        <Plus size={18} aria-hidden="true" />
        <span>추가</span>
      </button>
    </div>
  );
}
