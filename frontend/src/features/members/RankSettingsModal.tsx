import { useState, type SubmitEvent } from "react";
import { X } from "lucide-react";
import useModalDialog from "../../hooks/useModalDialog";
import styles from "./Modal.module.css";
import { DEFAULT_RANK_SETTINGS, DOMAIN_LIMITS } from "../../config/domain";
import {
  saveRankSettings,
  type RankSettings,
  type RankSettingsInput,
} from "./api";

interface Props {
  onClose: () => void;
  onSaved: () => void;
  initialData?: RankSettings | null;
}

const toFormData = (settings?: RankSettings | null): RankSettingsInput => ({
  min_rank: settings?.min_rank ?? DEFAULT_RANK_SETTINGS.min_rank,
  max_rank: settings?.max_rank ?? DEFAULT_RANK_SETTINGS.max_rank,
  default_member_rank:
    settings?.default_member_rank ?? DEFAULT_RANK_SETTINGS.default_member_rank,
  default_guest_rank:
    settings?.default_guest_rank ?? DEFAULT_RANK_SETTINGS.default_guest_rank,
  promotion_threshold:
    settings?.promotion_threshold ?? DEFAULT_RANK_SETTINGS.promotion_threshold,
  demotion_threshold:
    settings?.demotion_threshold ?? DEFAULT_RANK_SETTINGS.demotion_threshold,
});

export default function RankSettingsModal({
  onClose,
  onSaved,
  initialData,
}: Props) {
  const [formData, setFormData] = useState<RankSettingsInput>(() =>
    toFormData(initialData),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useModalDialog<HTMLDivElement>({
    isOpen: true,
    onClose,
    canClose: !isSaving,
  });

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (formData.min_rank >= formData.max_rank) {
      setError("최고 부수는 최저 부수보다 작은 숫자여야 합니다.");
      return;
    }

    const defaults = [
      formData.default_member_rank,
      formData.default_guest_rank,
    ];

    if (
      defaults.some(
        (rank) => rank < formData.min_rank || rank > formData.max_rank,
      )
    ) {
      setError("기본 부수는 최고 부수와 최저 부수 사이여야 합니다.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await saveRankSettings(initialData?.id ?? null, formData);
      await onSaved();
      onClose();
    } catch {
      setError(
        "설정을 저장하지 못했습니다. 입력값과 서버 연결을 확인해 주세요.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const updateNumber = (field: keyof RankSettingsInput, value: string) => {
    setFormData((current) => ({ ...current, [field]: Number(value) }));
  };

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onMouseDown={() => {
        if (!isSaving) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rank-settings-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id="rank-settings-title">부수 승강 기준 설정</h2>
          <button
            type="button"
            onClick={onClose}
            className={styles.closeBtn}
            aria-label="닫기"
            disabled={isSaving}
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="min-rank">최고 부수</label>
            <input
              id="min-rank"
              type="number"
              min={DOMAIN_LIMITS.absoluteRankMin}
              max={DOMAIN_LIMITS.absoluteRankMax}
              required
              className={styles.input}
              value={formData.min_rank}
              onChange={(event) => updateNumber("min_rank", event.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="max-rank">최저 부수</label>
            <input
              id="max-rank"
              type="number"
              min={DOMAIN_LIMITS.absoluteRankMin}
              max={DOMAIN_LIMITS.absoluteRankMax}
              required
              className={styles.input}
              value={formData.max_rank}
              onChange={(event) => updateNumber("max_rank", event.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="default-member-rank">신규 회원 기본 부수</label>
            <input
              id="default-member-rank"
              type="number"
              min={formData.min_rank}
              max={formData.max_rank}
              required
              className={styles.input}
              value={formData.default_member_rank}
              onChange={(event) =>
                updateNumber("default_member_rank", event.target.value)
              }
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="default-guest-rank">게스트 기본 부수</label>
            <input
              id="default-guest-rank"
              type="number"
              min={formData.min_rank}
              max={formData.max_rank}
              required
              className={styles.input}
              value={formData.default_guest_rank}
              onChange={(event) =>
                updateNumber("default_guest_rank", event.target.value)
              }
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="promotion-threshold">승급 기준 횟수</label>
            <input
              id="promotion-threshold"
              type="number"
              min={DOMAIN_LIMITS.positiveCountMin}
              required
              className={styles.input}
              value={formData.promotion_threshold}
              onChange={(event) =>
                updateNumber("promotion_threshold", event.target.value)
              }
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="demotion-threshold">강등 기준 횟수</label>
            <input
              id="demotion-threshold"
              type="number"
              min={DOMAIN_LIMITS.positiveCountMin}
              required
              className={styles.input}
              value={formData.demotion_threshold}
              onChange={(event) =>
                updateNumber("demotion_threshold", event.target.value)
              }
            />
          </div>

          <div className={styles.footer}>
            <button
              type="button"
              onClick={onClose}
              className={styles.btnCancel}
              disabled={isSaving}
            >
              취소
            </button>
            <button
              type="submit"
              className={styles.btnSubmit}
              disabled={isSaving}
            >
              {isSaving ? "저장 중…" : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
