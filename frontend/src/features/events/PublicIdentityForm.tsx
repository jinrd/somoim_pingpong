import {
  useState,
  type SubmitEvent,
} from 'react';

import {
  LogIn,
  UserCheck,
} from 'lucide-react';

import { ClientResponseError } from 'pocketbase';

import {
  identifyPublicParticipant,
} from './api';

import type {
  PublicIdentityResult,
} from './types';

import styles from '../../pages/public/PublicEvent.module.css';

interface Props {
  publicToken: string;
  onIdentified: (
    result: PublicIdentityResult,
  ) => void;
}

const formatPhoneNumber = (
  value: string,
): string => {
  const digits = value
    .replace(/[^0-9]/g, '')
    .slice(0, 11);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 7) {
    return (
      digits.slice(0, 3) +
      '-' +
      digits.slice(3)
    );
  }

  return (
    digits.slice(0, 3) +
    '-' +
    digits.slice(3, 7) +
    '-' +
    digits.slice(7)
  );
};

const getIdentityErrorMessage = (
  error: unknown,
): string => {
  if (error instanceof ClientResponseError) {
    return (
      error.response.message ||
      '본인 확인에 실패했습니다.'
    );
  }

  return '서버에 연결하지 못했습니다.';
};

export default function PublicIdentityForm({
  publicToken,
  onIdentified,
}: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [error, setError] = useState('');

  const handleSubmit = async (
    event: SubmitEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setIsSubmitting(true);
    setError('');

    try {
      const result =
        await identifyPublicParticipant(
          publicToken,
          {
            name: name.trim(),
            phone,
          },
        );

      // 다음 단계의 게임 참가 여부 변경에 사용합니다.
      sessionStorage.setItem(
        `event-participant:${publicToken}`,
        JSON.stringify(result),
      );

      onIdentified(result);
    } catch (caughtError) {
      setError(
        getIdentityErrorMessage(
          caughtError,
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      className={styles.identityForm}
      onSubmit={handleSubmit}
    >
      <div className={styles.identityHeading}>
        <UserCheck
          size={22}
          aria-hidden="true"
        />

        <div>
          <h2>본인 확인</h2>
          <p>
            회원 등록 시 입력한 이름과 연락처를
            입력해 주세요.
          </p>
        </div>
      </div>

      {error && (
        <p
          className={styles.formError}
          role="alert"
        >
          {error}
        </p>
      )}

      <label className={styles.formField}>
        <span>이름</span>

        <input
          type="text"
          value={name}
          required
          autoComplete="name"
          maxLength={100}
          placeholder="홍길동"
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
      </label>

      <label className={styles.formField}>
        <span>연락처</span>

        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          value={phone}
          required
          maxLength={13}
          pattern="010-[0-9]{4}-[0-9]{4}"
          placeholder="010-1234-5678"
          onChange={(event) => {
            setPhone(
              formatPhoneNumber(
                event.target.value,
              ),
            );
          }}
        />
      </label>

      <button
        type="submit"
        className={styles.identityButton}
        disabled={isSubmitting}
      >
        <LogIn
          size={18}
          aria-hidden="true"
        />

        {isSubmitting
          ? '확인 중…'
          : '본인 확인'}
      </button>
    </form>
  );
}