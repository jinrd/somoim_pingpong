import GameSettingsPanel from "../game-settings/GameSettingsPanel";
import type { EventGameSetting } from "../game-settings/types";
import MatchMonitorPanel from "../match-monitor/MatchMonitorPanel";
import MatchResultsPanel from "../match-results/MatchResultsPanel";
import IndividualSchedulePanel from "../match-schedule/IndividualSchedulePanel";
import TeamSchedulePanel from "../match-schedule/TeamSchedulePanel";
import LeagueStandingsPanel from "../standings/LeagueStandingsPanel";
import TeamFormationPanel from "../team-formation/TeamFormationPanel";
import PublicLinkManager from "./PublicLinkManager";
import type { TeamFormationStatus } from "../team-formation/types";
import styles from "./Events.module.css";
import type { EventManagementStep, EventWorkflow } from "./EventWorkflow";
import ParticipantManager from "./ParticipantManager";
import type { SomoimEvent } from "./types";

interface Props {
  activeStep: EventManagementStep;
  eventId: string;
  eventRecord: SomoimEvent;
  gameSetting: EventGameSetting | null;
  workflow: EventWorkflow;
  configurationRevision: number;
  onEventUpdated: (eventRecord: SomoimEvent) => void;
  onGameConfigurationReset: () => void;
  onSettingChanged: (setting: EventGameSetting | null) => void;
  onSettingConfigurationReset: () => void;
  onFormationChanged: (status: TeamFormationStatus | null) => void;
  onScheduleReset: () => void;
  onScheduleChanged: (hasSchedule: boolean) => void;
  onEventStatusChanged: () => void;
}

export default function EventManagementContent({
  activeStep,
  eventId,
  eventRecord,
  gameSetting,
  workflow,
  configurationRevision,
  onEventUpdated,
  onGameConfigurationReset,
  onSettingChanged,
  onSettingConfigurationReset,
  onFormationChanged,
  onScheduleReset,
  onScheduleChanged,
  onEventStatusChanged,
}: Props) {
  if (activeStep === "participants") {
    return (
      <div className={styles.tabPanel}>
        {eventRecord.status !== "archived" && (
          <PublicLinkManager
            eventRecord={eventRecord}
            onEventUpdated={onEventUpdated}
          />
        )}

        <ParticipantManager
          eventRecord={eventRecord}
          hasGameConfiguration={Boolean(gameSetting)}
          onEventUpdated={onEventUpdated}
          onGameConfigurationReset={onGameConfigurationReset}
        />
      </div>
    );
  }

  if (activeStep === "game-settings") {
    return (
      <div className={styles.tabPanel}>
        <GameSettingsPanel
          key={`settings-${configurationRevision}`}
          eventId={eventId}
          participationStatus={eventRecord.participation_status}
          onSettingChanged={onSettingChanged}
          onConfigurationReset={onSettingConfigurationReset}
        />
      </div>
    );
  }

  if (
    activeStep === "formation" &&
    workflow.canOpenFormation &&
    gameSetting?.competition_type === "team_league"
  ) {
    return (
      <div className={styles.tabPanel}>
        <TeamFormationPanel
          key={`formation-${configurationRevision}-${gameSetting.id}`}
          setting={gameSetting}
          onFormationChanged={onFormationChanged}
          onScheduleReset={onScheduleReset}
        />
      </div>
    );
  }

  if (activeStep === "schedule" && workflow.canOpenSchedule && gameSetting) {
    return (
      <div className={styles.tabPanel}>
        {gameSetting.competition_type === "team_league" ? (
          <TeamSchedulePanel
            setting={gameSetting}
            onScheduleChanged={onScheduleChanged}
          />
        ) : gameSetting.competition_type === "individual_singles" ? (
          <IndividualSchedulePanel
            setting={gameSetting}
            onScheduleChanged={onScheduleChanged}
          />
        ) : null}
      </div>
    );
  }

  if (activeStep === "monitor" && workflow.canOpenMatchViews) {
    return (
      <div className={styles.tabPanel}>
        <MatchMonitorPanel
          setting={gameSetting}
          onEventStatusChanged={onEventStatusChanged}
        />
      </div>
    );
  }

  if (activeStep === "results" && workflow.canOpenMatchViews && gameSetting) {
    return (
      <div className={styles.tabPanel}>
        <MatchResultsPanel setting={gameSetting} />
      </div>
    );
  }

  if (activeStep === "standings" && workflow.canOpenMatchViews && gameSetting) {
    return (
      <div className={styles.tabPanel}>
        <LeagueStandingsPanel setting={gameSetting} />
      </div>
    );
  }

  return null;
}
