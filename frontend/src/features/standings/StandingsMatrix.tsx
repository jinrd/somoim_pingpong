import { useMemo } from "react";

import type { StandingsMatch, StandingsResponse } from "./types";

import { getMatrixCellLabel, orientMatchForEntity } from "./standingsUtils";

import styles from "./LeagueStandingsPanel.module.css";

interface Props {
  response: StandingsResponse;
  onSelectMatch: (match: StandingsMatch) => void;
}

export default function StandingsMatrix({ response, onSelectMatch }: Props) {
  const matchesByEntities = useMemo(() => {
    const matchMap = new Map<string, StandingsMatch>();

    response.matches.forEach((match) => {
      matchMap.set(
        [match.homeEntity.id, match.awayEntity.id].sort().join(":"),
        match,
      );
    });

    return matchMap;
  }, [response.matches]);

  return (
    <table className={styles.matrix} aria-label="상대 전적표">
      <thead>
        <tr>
          <th className={styles.nameHeader}>
            {response.competitionType === "team_league" ? "팀" : "참가자"}
          </th>

          {response.entities.map((entity, index) => (
            <th key={entity.id}>
              <span className={styles.columnNumber}>{index + 1}</span>

              <span className={styles.columnName}>{entity.name}</span>
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {response.entities.map((rowEntity, rowIndex) => {
          return (
            <tr key={rowEntity.id}>
              <th className={styles.rowHeader}>
                <span>{rowIndex + 1}</span>

                <strong>{rowEntity.name}</strong>
              </th>

              {response.entities.map((columnEntity) => {
                if (rowEntity.id === columnEntity.id) {
                  return (
                    <td key={columnEntity.id} className={styles.selfCell}>
                      —
                    </td>
                  );
                }

                const match = matchesByEntities.get(
                  [rowEntity.id, columnEntity.id].sort().join(":"),
                );

                if (!match) {
                  return (
                    <td key={columnEntity.id} className={styles.emptyCell}>
                      -
                    </td>
                  );
                }

                const rowWon =
                  match.resultStatus === "confirmed" &&
                  match.winnerEntityId === rowEntity.id;

                const rowLost =
                  match.resultStatus === "confirmed" &&
                  Boolean(match.winnerEntityId) &&
                  !rowWon;
                const cellLabel = getMatrixCellLabel(match, rowEntity.id);

                return (
                  <td key={columnEntity.id}>
                    <button
                      type="button"
                      className={
                        match.resultStatus === "disputed"
                          ? styles.disputedCell
                          : rowWon
                            ? styles.winCell
                            : rowLost
                              ? styles.lossCell
                              : styles.resultCell
                      }
                      aria-label={`${rowEntity.name} 대 ${columnEntity.name}, ${cellLabel}, 경기 상세 보기`}
                      onClick={() =>
                        onSelectMatch(orientMatchForEntity(match, rowEntity.id))
                      }
                    >
                      {cellLabel}
                    </button>
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
