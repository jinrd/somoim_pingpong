import { useState, type SubmitEvent } from "react";
import { X } from "lucide-react";
import { ClientResponseError } from "pocketbase";
import styles from "./Modal.module.css";
import { DOMAIN_LIMITS } from "../../config/domain";
import {
  type Member,
  type MemberInput,
  type RankSettingsInput,
  createMember,
  updateMember,
} from "./api";

interface Props {
  onClose: () => void;
  onSaved: () => void;
  initialData?: Member | null;
  rankSettings: RankSettingsInput;
}

const PHONE_PATTERN = /^010-[0-9]{4}-[0-9]{4}$/;

const formatPhoneNumber = (value: string): string => {
  const digits = value.replace(/[^0-9]/g, "").slice(0, 11);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
};

const getSaveErrorMessage = (error: unknown): string => {
  if (!(error instanceof ClientResponseError)) {
    return "저장하지 못했습니다. 서버 연결을 확인해 주세요.";
  }

  if (error.status === 401 || error.status === 403) {
    return "로그인이 만료됐거나 저장 권한이 없습니다. 다시 로그인해 주세요.";
  }

  const fieldErrors = Object.values(error.response.data ?? {})
    .map((fieldError) => {
      if (
        typeof fieldError === "object" &&
        fieldError !== null &&
        "message" in fieldError &&
        typeof fieldError.message === "string"
      ) {
        return fieldError.message;
      }

      return null;
    })
    .filter((message): message is string => Boolean(message));

  if (fieldErrors.length > 0) {
    return fieldErrors.join(" ");
  }

  return error.response.message || "회원 정보를 저장하지 못했습니다.";
};

const toFormData = (
  rankSettings: RankSettingsInput,
  member?: Member | null,
): MemberInput => ({
  name: member?.name ?? "",
  nickname: member?.nickname ?? "",
  rank: member?.rank ?? rankSettings.default_member_rank,
  status: member?.status ?? "active",
  gender: member?.gender ?? "M",
  phone: formatPhoneNumber(member?.phone ?? ""),
  memo: member?.memo ?? "",
});

export default function MemberFormModal({
  onClose,
  onSaved,
  initialData,
  rankSettings,
}: Props) {
  const [formData, setFormData] = useState<MemberInput>(() =>
    toFormData(rankSettings, initialData),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    const phone = formData.phone?.trim() ?? "";

    if (phone && !PHONE_PATTERN.test(phone)) {
      setError("연락처는 010-1234-5678 형식으로 입력해 주세요.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const memberData: MemberInput = {
        ...formData,
        phone,
      };

      if (initialData?.id) {
        await updateMember(initialData.id, memberData);
      } else {
        await createMember(memberData);
      }
      onSaved();
      onClose();
    } catch (caughtError) {
      setError(getSaveErrorMessage(caughtError));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id="member-modal-title">
            {initialData ? "회원 수정" : "새 회원 추가"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={styles.closeBtn}
            aria-label="닫기"
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
            <label htmlFor="member-name">이름 *</label>
            <input
              id="member-name"
              required
              maxLength={DOMAIN_LIMITS.memberNameMaxLength}
              className={styles.input}
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="member-nickname">닉네임 *</label>
            <input
              id="member-nickname"
              required
              maxLength={DOMAIN_LIMITS.memberNicknameMaxLength}
              className={styles.input}
              value={formData.nickname}
              onChange={(e) =>
                setFormData({ ...formData, nickname: e.target.value })
              }
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="member-gender">성별</label>
            <select
              id="member-gender"
              className={styles.input}
              value={formData.gender}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  gender: e.target.value as "M" | "F",
                })
              }
            >
              <option value="M">남성 (M)</option>
              <option value="F">여성 (F)</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="member-phone">연락처</label>
            <input
              id="member-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              className={styles.input}
              placeholder="010-1234-5678"
              value={formData.phone}
              maxLength={DOMAIN_LIMITS.formattedPhoneLength}
              pattern="010-[0-9]{4}-[0-9]{4}"
              title="010-1234-5678 형식으로 입력해 주세요."
              onChange={(event) => {
                setFormData({
                  ...formData,
                  phone: formatPhoneNumber(event.target.value),
                });
              }}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="member-rank">부수 *</label>
            <input
              id="member-rank"
              type="number"
              min={rankSettings.min_rank}
              max={rankSettings.max_rank}
              required
              className={styles.input}
              value={formData.rank}
              onChange={(e) =>
                setFormData({ ...formData, rank: Number(e.target.value) })
              }
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="member-status">상태</label>
            <select
              id="member-status"
              className={styles.input}
              value={formData.status}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  status: e.target.value as "active" | "inactive",
                })
              }
            >
              <option value="active">활동중 (Active)</option>
              <option value="inactive">비활동 (Inactive)</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="member-memo">메모</label>
            <textarea
              id="member-memo"
              className={styles.input}
              value={formData.memo}
              onChange={(e) =>
                setFormData({ ...formData, memo: e.target.value })
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
