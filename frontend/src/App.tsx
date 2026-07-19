import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Login from './pages/Login';
import type { JSX } from 'react/jsx-runtime';

// 보호된 라우트 컴포넌트 (로그인 안 된 유저는 튕겨냄)
const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const isValid = useAuthStore((state) => state.isValid);
  if (!isValid) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// 아주 간단한 임시 대시보드 화면
const Dashboard = () => {
  const { logout } = useAuthStore();
  return (
    <div style={{ padding: '2rem' }}>
      <h1>관리자 대시보드</h1>
      <button onClick={logout} style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}>로그아웃</button>
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* 모든 관리자 페이지는 ProtectedRoute로 감쌉니다 */}
        <Route 
          path="/*" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}
