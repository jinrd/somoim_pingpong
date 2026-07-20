import Members from './pages/admin/Members';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import type { JSX } from 'react/jsx-runtime';
import Login from './pages/Login';
import AdminLayout from './components/layout/AdminLayout';



// 임시 대시보드 (나중에 분리 예정)
const Dashboard = () => (
  <div>
    <h2>환영합니다!</h2>
    <p>좌측 메뉴에서 회원 관리를 선택해 주세요.</p>
  </div>
);

// 로그인 안 된 유저는 튕겨냄
const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const isValid = useAuthStore((state) => state.isValid);
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
        
        {/* Admin Layout 적용 */}
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          {/* 중첩 라우트 (Outlet 위치에 들어감) */}
          <Route index element={<Dashboard />} />
          <Route path="members" element={<Members />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
