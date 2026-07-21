import { create } from "zustand";
import type { RecordModel } from "pocketbase";
import { pb } from "../lib/pocketbase";

interface AuthState {
  isInitialized: boolean;
  isValid: boolean;
  user: RecordModel | null;
  logout: () => void;
}

export const useAuthStore = create<AuthState>(() => ({
  isInitialized: !pb.authStore.isValid,
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

const validateStoredAuthentication = async () => {
  if (!pb.authStore.isValid) {
    useAuthStore.setState({ isInitialized: true });
    return;
  }

  try {
    await pb.collection("users").authRefresh();
  } catch {
    pb.authStore.clear();
  } finally {
    useAuthStore.setState({ isInitialized: true });
  }
};

// 브라우저에 남아 있는 토큰을 서버에서 다시 검증합니다.
// 만료됐거나 다른 Auth Collection의 토큰이면 자동으로 로그아웃합니다.
void validateStoredAuthentication();
