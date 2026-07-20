import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import type { JSX } from 'react/jsx-runtime';

import AdminLayout from './components/layout/AdminLayout';

import Login from './pages/Login';
import Events from './pages/admin/Events';
import Members from './pages/admin/Members';

import { useAuthStore } from './store/authStore';

const Dashboard = () => {
  return (
    <div>
      <h2>환영합니다!</h2>
      <p>
        메뉴에서 회원 또는 회차 관리를 선택해 주세요.
      </p>
    </div>
  );
};

/**
 * Phase 3-1D 구현 전까지 사용하는 임시 화면입니다.
 */
const EventDetailPlaceholder = () => {
  return (
    <div>
      <h2>회차 상세</h2>

      <p>
        참석자 관리 기능은 Phase 3-1D에서 구현합니다.
      </p>
    </div>
  );
};

interface ProtectedRouteProps {
  children: JSX.Element;
}

const ProtectedRoute = ({
  children,
}: ProtectedRouteProps) => {
  const isInitialized = useAuthStore(
    (state) => state.isInitialized,
  );

  const isValid = useAuthStore(
    (state) => state.isValid,
  );

  if (!isInitialized) {
    return (
      <div style={{ padding: '2rem' }}>
        로그인 상태를 확인하는 중입니다…
      </div>
    );
  }

  if (!isValid) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />

          <Route
            path="members"
            element={<Members />}
          />

          <Route
            path="events"
            element={<Events />}
          />

          <Route
            path="events/:eventId"
            element={<EventDetailPlaceholder />}
          />
        </Route>

        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}