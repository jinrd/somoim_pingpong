import { useState, type SubmitEvent } from "react";
import { X } from "lucide-react";
import { DOMAIN_LIMITS } from "../../config/domain";
import type { RankSettingsInput } from "../members/api";

import { addGuestToEvent } from "./api";

import type { EventParticipant, GameParticipationStatus } from "./types";

import styles from "./Events.module.css";

interface Props {
  eventId: string;
  onClose: () => void;
  onCreated: (participant: EventParticipant) => void;
  rankSettings: RankSettingsInput;
}

export default function GuestFormModal({
  eventId,
  onClose,
  onCreated,
  rankSettings,
}: Props) {
  const [name, setName] = useState("");
  const [rank, setRank] = useState(rankSettings.default_guest_rank);

  const [gameParticipationStatus, setGameParticipationStatus] =
    useState<GameParticipationStatus>("undecided");

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (submitEvent: SubmitEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();

    setIsSaving(true);
    setError("");

    try {
      const participant = await addGuestToEvent(eventId, {
        name,
        rank,
        gameParticipationStatus,
      });

      onCreated(participant);
      onClose();
    } catch (caughtError) {
      if (caughtError instanceof Error) {
        setError(caughtError.message);
      } else {
        setError("게스트를 추가하지 못했습니다.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guest-form-title"
        onMouseDown={(mouseEvent) => {
          mouseEvent.stopPropagation();
        }}
      >
        <div className={styles.modalHeader}>
          <h2 id="guest-form-title">게스트 추가</h2>

          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            disabled={isSaving}
            aria-label="게스트 추가 창 닫기"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <p className={styles.formError} role="alert">
              {error}
            </p>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="guest-name">게스트 이름 *</label>

            <input
              id="guest-name"
              type="text"
              className={styles.input}
              value={name}
              maxLength={DOMAIN_LIMITS.guestNameMaxLength}
              required
              autoFocus
              onChange={(changeEvent) => {
                setName(changeEvent.target.value);
              }}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="guest-rank">부수 *</label>

            <input
              id="guest-rank"
              type="number"
              className={styles.input}
              value={rank}
              min={rankSettings.min_rank}
              max={rankSettings.max_rank}
              required
              onChange={(changeEvent) => {
                setRank(Number(changeEvent.target.value));
              }}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="guest-game-status">게임 참가 여부</label>

            <select
              id="guest-game-status"
              className={styles.input}
              value={gameParticipationStatus}
              onChange={(changeEvent) => {
                setGameParticipationStatus(
                  changeEvent.target.value as GameParticipationStatus,
                );
              }}
            >
              <option value="undecided">미정</option>
              <option value="playing">게임 참가</option>
              <option value="not_playing">게임 미참가</option>
            </select>
          </div>

          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
              disabled={isSaving}
            >
              취소
            </button>

            <button
              type="submit"
              className={styles.primaryButton}
              disabled={isSaving}
            >
              {isSaving ? "추가 중…" : "게스트 추가"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
