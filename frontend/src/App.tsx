import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import type { JSX } from "react/jsx-runtime";

import AdminLayout from "./components/layout/AdminLayout";

import { useAuthStore } from "./store/authStore";

const Login = lazy(() => import("./pages/Login"));
const Events = lazy(() => import("./pages/admin/Events"));
const Members = lazy(() => import("./pages/admin/Members"));
const Rankings = lazy(() => import("./pages/admin/Rankings"));
const EventDetail = lazy(() => import("./pages/admin/EventDetail"));
const PublicEvent = lazy(() => import("./pages/public/PublicEvent"));
const Dashboard = lazy(() => import("./pages/admin/Dashboard"));

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
      <Suspense
        fallback={
          <div className="route-loading" role="status">
            화면을 불러오는 중입니다…
          </div>
        }
      >
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

            <Route path="rankings" element={<Rankings />} />

            <Route path="events" element={<Events />} />

            <Route path="events/:eventId" element={<EventDetail />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
