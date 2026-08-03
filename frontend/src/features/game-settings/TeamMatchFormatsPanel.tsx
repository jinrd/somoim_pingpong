import { Save } from "lucide-react";

import GameMatchFormatList from "./GameMatchFormatList";
import { TEAM_MATCH_FORMAT_COUNTS } from "./constants";
import { isValidTeamMatchFormatCount } from "./gameSettingUtils";
import type { MatchFormatDraft } from "./types";

import styles from "./GameSettings.module.css";

interface Props {
  hasSetting: boolean;
  formats: MatchFormatDraft[];
  isConfirmed: boolean;
  isWorking: boolean;
  isDirty: boolean;
  onFormatChange: (format: MatchFormatDraft) => void;
  onCountChange: (count: number) => void;
  onReorder: (formats: MatchFormatDraft[]) => void;
  onSave: () => void;
}

export default function TeamMatchFormatsPanel({
  hasSetting,
  formats,
  isConfirmed,
  isWorking,
  isDirty,
  onFormatChange,
  onCountChange,
  onReorder,
  onSave,
}: Props) {
  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <div>
          <h2>팀 대결 세부 경기</h2>
          <p>세부 경기는 1·3·5개로 구성합니다.</p>
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
          {!isConfirmed && (
            <label className={styles.formatCountControl}>
              <span>세부 경기 수</span>
              <select
                value={formats.length}
                disabled={isWorking}
                onChange={(event) => onCountChange(Number(event.target.value))}
              >
                {!isValidTeamMatchFormatCount(formats.length) && (
                  <option value={formats.length} disabled>
                    {formats.length === 0
                      ? "선택해 주세요"
                      : `${formats.length}개 · 수정 필요`}
                  </option>
                )}
                {TEAM_MATCH_FORMAT_COUNTS.map((count) => (
                  <option key={count} value={count}>
                    {count}개
                  </option>
                ))}
              </select>
            </label>
          )}

          <GameMatchFormatList
            formats={formats}
            disabled={isWorking || isConfirmed}
            onFormatChange={onFormatChange}
            onReorder={onReorder}
          />
        </>
      )}
    </section>
  );
}
