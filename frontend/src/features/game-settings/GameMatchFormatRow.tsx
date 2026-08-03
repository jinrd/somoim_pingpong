import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  MATCH_TYPE_LABELS,
  type MatchFormatDraft,
  type MatchType,
} from "./types";

import styles from "./GameSettings.module.css";

interface Props {
  format: MatchFormatDraft;
  position: number;
  isLast: boolean;
  disabled: boolean;
  onChange: (format: MatchFormatDraft) => void;
  onMoved: (formatKey: string, direction: -1 | 1) => void;
}

export default function GameMatchFormatRow({
  format,
  position,
  isLast,
  disabled,
  onChange,
  onMoved,
}: Props) {
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
          <span>번</span>

          <div className={styles.mobileOrderActions}>
            <button
              type="button"
              disabled={disabled || position === 1}
              aria-label={`${position}번 경기를 위로 이동`}
              onClick={() => onMoved(format.key, -1)}
            >
              <ChevronUp size={17} aria-hidden="true" />
            </button>

            <button
              type="button"
              disabled={disabled || isLast}
              aria-label={`${position}번 경기를 아래로 이동`}
              onClick={() => onMoved(format.key, 1)}
            >
              <ChevronDown size={17} aria-hidden="true" />
            </button>
          </div>
        </div>

        <label className={styles.compactField}>
          <span>경기 방식</span>

          <select
            value={format.matchType}
            disabled={disabled}
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
          <span>총 판수</span>

          <div className={styles.inputWithUnit}>
            <input
              type="number"
              min={1}
              step={2}
              value={format.bestOf}
              disabled={disabled}
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
          <span>부수 승강 반영</span>
        </label>
      </div>
    </div>
  );
}
