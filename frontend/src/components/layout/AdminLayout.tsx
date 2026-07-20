import { Outlet, NavLink } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Users, LayoutDashboard, LogOut } from 'lucide-react';
import styles from './AdminLayout.module.css';

export default function AdminLayout() {
  const { logout } = useAuthStore();

  return (
    <div className={styles.layout}>
      {/* 왼쪽 사이드바 */}
      <aside className={styles.sidebar}>
        <div className={styles.logo}>🏓 탁구 매니저</div>
        <nav className={styles.nav}>
          <NavLink 
            to="/" 
            className={({ isActive }) => isActive ? `${styles.navItem} ${styles.activeNavItem}` : styles.navItem}
            end
          >
            <LayoutDashboard size={20} />
            대시보드
          </NavLink>
          <NavLink 
            to="/members" 
            className={({ isActive }) => isActive ? `${styles.navItem} ${styles.activeNavItem}` : styles.navItem}
          >
            <Users size={20} />
            회원 관리
          </NavLink>
        </nav>
        <button onClick={logout} className={styles.logoutBtn}>
          <LogOut size={18} />
          로그아웃
        </button>
      </aside>

      {/* 오른쪽 메인 영역 */}
      <main className={styles.mainContent}>
        <header className={styles.header}>
          관리자 페이지
        </header>
        <div className={styles.content}>
          {/* Outlet 자리에 라우터에 설정된 하위 컴포넌트(Dashboard, Members 등)가 표시됩니다 */}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
