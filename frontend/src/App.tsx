import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import type { JSX } from "react/jsx-runtime";

import AdminLayout from "./components/layout/AdminLayout";

import Login from "./pages/Login";
import Events from "./pages/admin/Events";
import Members from "./pages/admin/Members";
import EventDetail from "./pages/admin/EventDetail";
import PublicEvent from "./pages/public/PublicEvent";
import { useAuthStore } from "./store/authStore";

const Dashboard = () => {
  return (
    <div>
      <h2>환영합니다!</h2>
      <p>메뉴에서 회원 또는 회차 관리를 선택해 주세요.</p>
    </div>
  );
};

interface ProtectedRouteProps {
  children: JSX.Element;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const isInitialized = useAuthStore((state) => state.isInitialized);

  const isValid = useAuthStore((state) => state.isValid);

  if (!isInitialized) {
    return (
      <div style={{ padding: "2rem" }}>로그인 상태를 확인하는 중입니다…</div>
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

        <Route path="/join/events/:token" element={<PublicEvent />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />

          <Route path="members" element={<Members />} />

          <Route path="events" element={<Events />} />

          <Route path="events/:eventId" element={<EventDetail />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
