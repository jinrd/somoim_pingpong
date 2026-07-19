import { create } from 'zustand';
import type { RecordModel } from 'pocketbase';
import { pb } from '../lib/pocketbase';

interface AuthState {
  isValid: boolean;
  user: RecordModel | null;
  logout: () => void;
}

export const useAuthStore = create<AuthState>(() => ({
  isValid: pb.authStore.isValid,
  user: pb.authStore.record,
  logout: () => {
    pb.authStore.clear();
  },
}));

// 로그인, 로그아웃, 토큰 갱신 및 다른 탭의 인증 변경을 Zustand에 반영합니다.
pb.authStore.onChange((_token, record) => {
  useAuthStore.setState({
    isValid: pb.authStore.isValid,
    user: record,
  });
});
