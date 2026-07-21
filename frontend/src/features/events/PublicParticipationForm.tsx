import { useState, type SubmitEvent } from "react";

import { Check, Gamepad2, PauseCircle } from "lucide-react";

import { ClientResponseError } from "pocketbase";

import { updateOwnGameParticipation } from "./api";

import type {
  PublicGameParticipationStatus,
  PublicIdentifiedParticipant,
} from "./types";

import styles from "../../pages/public/PublicEvent.module.css";

interface Props {
  responseToken: string;
  participant: PublicIdentifiedParticipant;

  onUpdated: (participant: PublicIdentifiedParticipant) => void;
}

const getInitialStatus = (
  participant: PublicIdentifiedParticipant,
): PublicGameParticipationStatus | "" => {
  if (
    participant.gameParticipationStatus === "playing" ||
    participant.gameParticipationStatus === "not_playing"
  ) {
    return participant.gameParticipationStatus;
  }

  return "";
};

const getUpdateErrorMessage = (error: unknown): string => {
  if (error instanceof ClientResponseError) {
    return error.response.message || "게임 참가 여부를 저장하지 못했습니다.";
  }

  return "서버에 연결하지 못했습니다.";
};

export default function PublicParticipationForm({
  responseToken,
  participant,
  onUpdated,
}: Props) {
  const [selectedStatus, setSelectedStatus] = useState<
    PublicGameParticipationStatus | ""
  >(() => getInitialStatus(participant));

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedStatus) {
      setError("게임 참가 또는 게임 미참가를 선택해 주세요.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setMessage("");

    try {
      const result = await updateOwnGameParticipation({
        responseToken,
        gameParticipationStatus: selectedStatus,
      });

      onUpdated(result.participant);

      setMessage(
        selectedStatus === "playing"
          ? "게임 참가로 저장했습니다."
          : "게임 미참가로 저장했습니다.",
      );
    } catch (caughtError) {
      setError(getUpdateErrorMessage(caughtError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className={styles.participationForm} onSubmit={handleSubmit}>
      <div>
        <h2>게임 참가 여부</h2>

        <p className={styles.participationHelp}>
          모임에는 참석하지만 게임에 참여하지 않을 수도 있습니다.
        </p>
      </div>

      <div className={styles.statusOptions}>
        <label
          className={
            selectedStatus === "playing"
              ? styles.statusOptionSelected
              : styles.statusOption
          }
        >
          <input
            type="radio"
            name="game-participation-status"
            value="playing"
            checked={selectedStatus === "playing"}
            onChange={() => {
              setSelectedStatus("playing");
            }}
          />

          <Gamepad2 size={22} aria-hidden="true" />

          <span>
            <strong>게임 참가</strong>
            <small>팀 편성 및 경기 진행에 참여합니다.</small>
          </span>
        </label>

        <label
          className={
            selectedStatus === "not_playing"
              ? styles.statusOptionSelected
              : styles.statusOption
          }
        >
          <input
            type="radio"
            name="game-participation-status"
            value="not_playing"
            checked={selectedStatus === "not_playing"}
            onChange={() => {
              setSelectedStatus("not_playing");
            }}
          />

          <PauseCircle size={22} aria-hidden="true" />

          <span>
            <strong>게임 미참가</strong>
            <small>모임에는 참석하지만 게임에는 참여하지 않습니다.</small>
          </span>
        </label>
      </div>

      {error && (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      )}

      {message && (
        <p className={styles.saveSuccess} role="status">
          <Check size={17} aria-hidden="true" />
          {message}
        </p>
      )}

      <button
        type="submit"
        className={styles.identityButton}
        disabled={isSubmitting || !selectedStatus}
      >
        {isSubmitting ? "저장 중…" : "게임 참가 여부 저장"}
      </button>
    </form>
  );
}
