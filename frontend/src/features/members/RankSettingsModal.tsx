import { useState, type SubmitEvent } from 'react';
import { X } from 'lucide-react';
import styles from './Modal.module.css';
import {
  saveRankSettings,
  type RankSettings,
  type RankSettingsInput,
} from './api';

interface Props {
  onClose: () => void;
  onSaved: () => void;
  initialData?: RankSettings | null;
}

const toFormData = (settings?: RankSettings | null): RankSettingsInput => ({
  min_rank: settings?.min_rank ?? 1,
  max_rank: settings?.max_rank ?? 8,
  promotion_threshold: settings?.promotion_threshold ?? 3,
  demotion_threshold: settings?.demotion_threshold ?? 3,
});

export default function RankSettingsModal({ onClose, onSaved, initialData }: Props) {
  const [formData, setFormData] = useState<RankSettingsInput>(() => toFormData(initialData));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (formData.min_rank >= formData.max_rank) {
      setError('최고 부수는 최저 부수보다 작은 숫자여야 합니다.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      await saveRankSettings(initialData?.id ?? null, formData);
      await onSaved();
      onClose();
    } catch {
      setError('설정을 저장하지 못했습니다. 입력값과 서버 연결을 확인해 주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateNumber = (field: keyof RankSettingsInput, value: string) => {
    setFormData((current) => ({ ...current, [field]: Number(value) }));
  };

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={onClose}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="rank-settings-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <h2 id="rank-settings-title">부수 승강 기준 설정</h2>
          <button type="button" onClick={onClose} className={styles.closeBtn} aria-label="닫기">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <p className={styles.error} role="alert">{error}</p>}

          <div className={styles.formGroup}>
            <label htmlFor="min-rank">최고 부수</label>
            <input id="min-rank" type="number" min={1} required className={styles.input} value={formData.min_rank} onChange={(event) => updateNumber('min_rank', event.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="max-rank">최저 부수</label>
            <input id="max-rank" type="number" min={2} required className={styles.input} value={formData.max_rank} onChange={(event) => updateNumber('max_rank', event.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="promotion-threshold">승급 기준 횟수</label>
            <input id="promotion-threshold" type="number" min={1} required className={styles.input} value={formData.promotion_threshold} onChange={(event) => updateNumber('promotion_threshold', event.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="demotion-threshold">강등 기준 횟수</label>
            <input id="demotion-threshold" type="number" min={1} required className={styles.input} value={formData.demotion_threshold} onChange={(event) => updateNumber('demotion_threshold', event.target.value)} />
          </div>

          <div className={styles.footer}>
            <button type="button" onClick={onClose} className={styles.btnCancel} disabled={isSaving}>취소</button>
            <button type="submit" className={styles.btnSubmit} disabled={isSaving}>{isSaving ? '저장 중…' : '저장'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
