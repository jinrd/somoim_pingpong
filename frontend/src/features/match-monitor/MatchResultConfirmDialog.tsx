import { ClipboardCheck, Loader2, Pencil, X } from "lucide-react";

import useModalDialog from "../../hooks/useModalDialog";
import type { MonitorResult } from "./types";

import {
  getBestOfLabel,
  getRequiredWins,
} from "../match-schedule/matchFormatUtils";

import styles from "./MatchMonitorPanel.module.css";

interface Props {
  target: MonitorResult | null;
  homeScore: number;
  awayScore: number;
  reason: string;
  homeParticipantIds: string[];
  awayParticipantIds: string[];
  error: string;
  isWorking: boolean;
  onHomeScoreChange: (score: number) => void;
  onAwayScoreChange: (score: number) => void;
  onReasonChange: (reason: string) => void;
  onHomeParticipantIdsChange: (ids: string[]) => void;
  onAwayParticipantIdsChange: (ids: string[]) => void;
  onClose: () => void;
  onConfirm: () => void;
}


export default function MatchResultConfirmDialog({
  target,
  homeScore,
  awayScore,
  reason,
  homeParticipantIds,
  awayParticipantIds,
  error,
  isWorking,
  onHomeScoreChange,
  onAwayScoreChange,
  onReasonChange,
  onHomeParticipantIdsChange,
  onAwayParticipantIdsChange,
  onClose,
  onConfirm,
}: Props) {
  const dialogRef = useModalDialog<HTMLElement>({
    isOpen: Boolean(target),
    onClose,
    canClose: !isWorking,
  });

  if (!target) {
    return null;
  }

  const isEditingResult = target.resultStatus === "confirmed";

  const requiredWins = getRequiredWins(target.bestOf);
  const scoreOptions = Array.from(
    { length: requiredWins + 1 },
    (_, score) => score,
  );

  const togglePlayer = (
    participantId: string,
    selectedIds: string[],
    onChange: (ids: string[]) => void,
  ) => {
    if (selectedIds.includes(participantId)) {
      onChange(selectedIds.filter((id) => id !== participantId));
      return;
    }

    onChange(
      selectedIds.length < target.requiredPlayerCount
        ? [...selectedIds, participantId]
        : [...selectedIds.slice(1), participantId],
    );
  };

  return (
    <div
      className={styles.modalBackdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isWorking) {
          onClose();
        }
      }}
    >
      <section
        ref={dialogRef}
        className={styles.resultModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-result-title"
      >
        <header>
          <div>
            <span className={styles.resultModalEyebrow}>
              {isEditingResult ? "운영진 결과 수정" : "운영진 결과 입력"}
            </span>
            <h3 id="admin-result-title">{target.title}</h3>
          </div>

          <button
            type="button"
            className={styles.modalCloseButton}
            disabled={isWorking}
            onClick={onClose}
            aria-label={
              isEditingResult
                ? "운영진 결과 수정 창 닫기"
                : "운영진 결과 입력 창 닫기"
            }
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <p className={styles.resultHelp}>
          {isEditingResult
            ? "확정된 점수와 실제 출전 선수를 수정합니다."
            : "최종 점수와 실제 출전 선수를 입력합니다."}
        </p>

        {target.type === "team_game" && (
          <div className={styles.playerSelectors}>
            {[
              {
                name: target.homeName,
                options: target.homePlayerOptions,
                selectedIds: homeParticipantIds,
                onChange: onHomeParticipantIdsChange,
              },
              {
                name: target.awayName,
                options: target.awayPlayerOptions,
                selectedIds: awayParticipantIds,
                onChange: onAwayParticipantIdsChange,
              },
            ].map((side) => (
              <fieldset key={side.name} className={styles.playerSelector}>
                <legend>
                  {side.name} 출전자
                  <span>
                    {side.selectedIds.length}/{target.requiredPlayerCount}
                  </span>
                </legend>
                <div>
                  {side.options.map((player) => {
                    const isSelected = side.selectedIds.includes(
                      player.participantId,
                    );

                    return (
                      <button
                        key={player.participantId}
                        type="button"
                        className={isSelected ? styles.playerSelected : ""}
                        aria-pressed={isSelected}
                        disabled={isWorking}
                        onClick={() =>
                          togglePlayer(
                            player.participantId,
                            side.selectedIds,
                            side.onChange,
                          )
                        }
                      >
                        {player.name}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        )}

        <div className={styles.scoreEditor}>
          <label>
            <span>{target.homeName}</span>
            <select
              value={homeScore}
              disabled={isWorking}
              onChange={(event) =>
                onHomeScoreChange(Number(event.target.value))
              }
            >
              {scoreOptions.map((score) => (
                <option key={score} value={score}>
                  {score}
                </option>
              ))}
            </select>
          </label>

          <strong>:</strong>

          <label>
            <span>{target.awayName}</span>
            <select
              value={awayScore}
              disabled={isWorking}
              onChange={(event) =>
                onAwayScoreChange(Number(event.target.value))
              }
            >
              {scoreOptions.map((score) => (
                <option key={score} value={score}>
                  {score}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className={styles.scoreRule}>
          {getBestOfLabel(target.bestOf)}
        </p>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <label className={styles.reasonField}>
          <span>{isEditingResult ? "수정 사유" : "입력 사유"}</span>
          <textarea
            value={reason}
            maxLength={500}
            rows={3}
            disabled={isWorking}
            placeholder={
              isEditingResult
                ? "예: 점수가 잘못 입력되어 실제 결과로 수정합니다."
                : "예: 참가자가 현장에서 결과 입력을 요청했습니다."
            }
            onChange={(event) => onReasonChange(event.target.value)}
          />
          <small>{reason.length}/500</small>
        </label>

        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.modalCancelButton}
            disabled={isWorking}
            onClick={onClose}
          >
            돌아가기
          </button>

          <button
            type="button"
            className={styles.confirmResultButton}
            disabled={isWorking}
            onClick={onConfirm}
          >
            {isWorking ? (
              <Loader2
                className={styles.spinner}
                size={17}
                aria-hidden="true"
              />
            ) : isEditingResult ? (
              <Pencil size={17} aria-hidden="true" />
            ) : (
              <ClipboardCheck size={17} aria-hidden="true" />
            )}
            {isEditingResult ? "결과 수정" : "결과 확정"}
          </button>
        </div>
      </section>
    </div>
  );
}
