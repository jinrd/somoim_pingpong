import { CalendarDays, LayoutDashboard, LogOut, Users } from "lucide-react";

import { NavLink, Outlet } from "react-router-dom";

import { useAuthStore } from "../../store/authStore";

import styles from "./AdminLayout.module.css";

const getNavLinkClassName = ({ isActive }: { isActive: boolean }): string => {
  if (isActive) {
    return `${styles.navItem} ${styles.activeNavItem}`;
  }

  return styles.navItem;
};

export default function AdminLayout() {
  const logout = useAuthStore((state) => state.logout);

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>🏓 탁구 매니저</div>

        <nav className={styles.nav} aria-label="관리자 주요 메뉴">
          <NavLink to="/" className={getNavLinkClassName} end>
            <LayoutDashboard size={20} aria-hidden="true" />

            <span>대시보드</span>
          </NavLink>

          <NavLink to="/members" className={getNavLinkClassName}>
            <Users size={20} aria-hidden="true" />

            <span>회원 관리</span>
          </NavLink>

          <NavLink to="/events" className={getNavLinkClassName}>
            <CalendarDays size={20} aria-hidden="true" />

            <span>회차 관리</span>
          </NavLink>
        </nav>

        <button type="button" onClick={logout} className={styles.logoutBtn}>
          <LogOut size={18} aria-hidden="true" />

          <span>로그아웃</span>
        </button>
      </aside>

      <main className={styles.mainContent}>
        <header className={styles.header}>Somoim PingPong Manager</header>

        <div className={styles.content}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
