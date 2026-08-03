import { useId } from "react";

import { AlertTriangle, X } from "lucide-react";

import useModalDialog from "../../hooks/useModalDialog";
import type { StandingsCompetitionType, StandingsMatch } from "./types";

import styles from "./LeagueStandingsPanel.module.css";

interface Props {
  match: StandingsMatch;
  competitionType: StandingsCompetitionType;
  onClose: () => void;
}

export default function StandingsMatchDetail({
  match,
  competitionType,
  onClose,
}: Props) {
  const titleId = useId();
  const dialogRef = useModalDialog<HTMLElement>({
    isOpen: true,
    onClose,
  });

  return (
    <section
      ref={dialogRef}
      className={styles.detail}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <header>
        <div>
          <span>
            {match.round}라운드 · {match.sortOrder}번째 경기
          </span>

          <h3
            id={titleId}
            className={styles.detailTitle}
          >
            <span>{match.homeEntity.name}</span>
            <small>VS</small>
            <span>{match.awayEntity.name}</span>
          </h3>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="경기 상세 닫기"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </header>

      {competitionType === "individual_singles" ? (
        <div className={styles.detailScore}>
          <div className={styles.detailScoreSide}>
            <span>{match.homeEntity.name}</span>

            <strong>
              {match.resultStatus === "confirmed" ? match.homeScore : "-"}
            </strong>
          </div>

          <span className={styles.detailScoreDivider}>:</span>

          <div className={styles.detailScoreSide}>
            <span>{match.awayEntity.name}</span>

            <strong>
              {match.resultStatus === "confirmed" ? match.awayScore : "-"}
            </strong>
          </div>
        </div>
      ) : (
        <div className={styles.gameList}>
          {match.games.map((game) => (
            <article key={game.id}>
              <div>
                <strong>
                  {game.sequence}.{" "}
                  {game.matchType === "singles" ? "단식" : "복식"}
                </strong>

                {game.resultStatus === "disputed" && (
                  <span className={styles.detailWarning}>
                    <AlertTriangle size={14} aria-hidden="true" />
                    입력 불일치
                  </span>
                )}
              </div>

              <div className={styles.gameScoreRow}>
                <span>
                  {game.homePlayers.map((player) => player.name).join(" · ") ||
                    "출전 미정"}
                </span>

                <strong>
                  {game.resultStatus === "confirmed"
                    ? `${game.homeScore} : ${game.awayScore}`
                    : "- : -"}
                </strong>

                <span>
                  {game.awayPlayers.map((player) => player.name).join(" · ") ||
                    "출전 미정"}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
