import { useState, type SubmitEvent } from 'react';
import { X } from 'lucide-react';
import styles from './Modal.module.css';
import { type Member, type MemberInput, createMember, updateMember } from './api';

interface Props {
  onClose: () => void;
  onSaved: () => void;
  initialData?: Member | null;
}

const toFormData = (member?: Member | null): MemberInput => ({
  name: member?.name ?? '',
  nickname: member?.nickname ?? '',
  rank: member?.rank ?? 8,
  status: member?.status ?? 'active',
  gender: member?.gender ?? 'M',
  phone: member?.phone ?? '',
  memo: member?.memo ?? '',
});

export default function MemberFormModal({ onClose, onSaved, initialData }: Props) {
  const [formData, setFormData] = useState<MemberInput>(() => toFormData(initialData));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');

    try {
      if (initialData?.id) {
        await updateMember(initialData.id, formData);
      } else {
        await createMember(formData);
      }
      onSaved();
      onClose();
    } catch {
      setError('저장하지 못했습니다. 입력값과 서버 연결을 확인해 주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={onClose}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="member-modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <h2 id="member-modal-title">{initialData ? '회원 수정' : '새 회원 추가'}</h2>
          <button type="button" onClick={onClose} className={styles.closeBtn} aria-label="닫기"><X size={24} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <div className={styles.formGroup}>
            <label htmlFor="member-name">이름 *</label>
            <input id="member-name" required maxLength={100} className={styles.input} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="member-nickname">닉네임 *</label>
            <input id="member-nickname" required maxLength={100} className={styles.input} value={formData.nickname} onChange={e => setFormData({...formData, nickname: e.target.value})} />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="member-gender">성별</label>
            <select id="member-gender" className={styles.input} value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value as 'M'|'F'})}>
              <option value="M">남성 (M)</option>
              <option value="F">여성 (F)</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="member-phone">연락처</label>
            <input id="member-phone" className={styles.input} placeholder="010-0000-0000" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="member-rank">부수 *</label>
            <input id="member-rank" type="number" min={1} max={99} required className={styles.input} value={formData.rank} onChange={e => setFormData({...formData, rank: Number(e.target.value)})} />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="member-status">상태</label>
            <select id="member-status" className={styles.input} value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as 'active'|'inactive'})}>
              <option value="active">활동중 (Active)</option>
              <option value="inactive">비활동 (Inactive)</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="member-memo">메모</label>
            <textarea id="member-memo" className={styles.input} value={formData.memo} onChange={e => setFormData({...formData, memo: e.target.value})} />
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
