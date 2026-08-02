import styles from "./Events.module.css";

interface Props {
  isParticipationClosed: boolean;
  hasStartedMatches: boolean;
  isLoading: boolean;
  isWorking: boolean;
  onCloseRequest: () => void;
}

export default function ParticipationStatusPanel({
  isParticipationClosed,
  hasStartedMatches,
  isLoading,
  isWorking,
  onCloseRequest,
}: Props) {
  if (hasStartedMatches) {
    return (
      <div className={styles.errorPanel} role="alert">
        <p>
          경기가 시작되었습니다. 참석자 상태와 경기 구성은 더 이상 변경할 수
          없습니다.
        </p>
      </div>
    );
  }

  if (isParticipationClosed) {
    return (
      <div className={styles.workflowNotice}>
        <strong>참가 신청이 최종 마감되었습니다.</strong>
        <p>
          참석자 추가·삭제는 할 수 없습니다. 기존 참석자는 게임 참가 또는 게임
          미참가로만 변경할 수 있으며, 경기 구성이 있으면 변경 시 모두
          초기화됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.workflowNotice}>
      <strong>참가 신청 접수 중</strong>
      <p>
        게임 참가 인원을 확인한 뒤 최종 마감해 주세요. 마감은 취소하거나 다시
        열 수 없습니다.
      </p>

      <button
        type="button"
        className={styles.primaryButton}
        disabled={isWorking || isLoading}
        onClick={onCloseRequest}
      >
        참가 신청 최종 마감
      </button>
    </div>
  );
}
