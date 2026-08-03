import type { EventGameSetting } from "../game-settings/types";
import type {
  IndividualScheduleContext,
  TeamScheduleContext,
} from "../match-schedule/api";

export interface MatchResultsPanelProps {
  setting: EventGameSetting | null;
}

export type ResultsContext =
  | {
      competitionType: "team_league";
      schedule: TeamScheduleContext;
    }
  | {
      competitionType: "individual_singles";
      schedule: IndividualScheduleContext;
    };
