import { Save } from "lucide-react";

import GameMatchFormatForm from "./GameMatchFormatForm";
import GameMatchFormatList from "./GameMatchFormatList";
import type { MatchFormatDraft, MatchFormatInput } from "./types";

import styles from "./GameSettings.module.css";

interface Props {
  hasSetting: boolean;
  formats: MatchFormatDraft[];
  newFormat: MatchFormatInput;
  isConfirmed: boolean;
  isWorking: boolean;
  isDirty: boolean;
  onFormatChange: (format: MatchFormatDraft) => void;
  onDelete: (formatKey: string) => void;
  onReorder: (formats: MatchFormatDraft[]) => void;
  onNewFormatChange: (format: MatchFormatInput) => void;
  onAdd: () => void;
  onSave: () => void;
}

export default function TeamMatchFormatsPanel({
  hasSetting,
  formats,
  newFormat,
  isConfirmed,
  isWorking,
  isDirty,
  onFormatChange,
  onDelete,
  onReorder,
  onNewFormatChange,
  onAdd,
  onSave,
}: Props) {
  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <div>
          <h2>팀 대결 세부 경기</h2>
          <p>세트와 단식·복식 순서를 설정할 수 있습니다.</p>
        </div>

        {!isConfirmed && (
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={isWorking || !isDirty}
              onClick={onSave}
            >
              <Save size={18} aria-hidden="true" />
              {isWorking ? "저장 중…" : "저장"}
            </button>
          </div>
        )}
      </header>

      {!hasSetting ? (
        <p className={styles.notice}>
          세부 경기를 추가하려면 먼저 게임 설정을 저장해 주세요.
        </p>
      ) : (
        <>
          <GameMatchFormatList
            formats={formats}
            disabled={isWorking || isConfirmed}
            onFormatChange={onFormatChange}
            onDelete={onDelete}
            onReorder={onReorder}
          />

          {!isConfirmed && (
            <GameMatchFormatForm
              format={newFormat}
              position={formats.length + 1}
              disabled={isWorking}
              onChange={onNewFormatChange}
              onAdd={onAdd}
            />
          )}
        </>
      )}
    </section>
  );
}
