import type { StandingsRow } from "./types";

import { formatSetRatio } from "./standingsUtils";

import styles from "./LeagueStandingsPanel.module.css";

interface Props {
  standings: StandingsRow[];
}

export default function StandingsRanking({ standings }: Props) {
  return (
    <>
      <header className={styles.rankingHeader}>
        <div>
          <h3>현재 순위</h3>
          <p>승 2점 · 패 1점 · 동률 시 승자승, 세트 득실률 순</p>
        </div>
      </header>

      <div className={styles.rankingList}>
        {standings.map((row) => (
          <article
            key={row.entityId}
            className={styles.rankingCard}
            data-rank={row.rank}
          >
            <strong className={styles.rankingPosition}>
              {row.rank}
              <small>위</small>
            </strong>

            <div className={styles.rankingIdentity}>
              <strong>{row.name}</strong>
              <span>
                {row.played}경기 · {row.wins}승 {row.losses}패
              </span>
            </div>

            <dl className={styles.rankingStats}>
              <div>
                <dt>승점</dt>
                <dd>{row.points}</dd>
              </div>
              <div>
                <dt>세트 득실률</dt>
                <dd>{formatSetRatio(row)}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </>
  );
}
