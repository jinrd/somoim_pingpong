import { useState, type SubmitEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, LoaderCircle, Lock, Mail } from "lucide-react";
import { pb } from "../lib/pocketbase";
import styles from "./Login.module.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 서비스 운영진은 PocketBase superuser가 아닌 users Auth Collection으로 로그인합니다.
      await pb.collection("users").authWithPassword(email, password);
      navigate("/"); // 로그인 성공 시 대시보드로 이동
    } catch {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.glowOrb1} />
      <div className={styles.glowOrb2} />

      <div className={styles.card}>
        <div className={styles.brandHeader}>
          <div className={styles.brandBadge}>🏓</div>
          <h1 className={styles.title}>탁꾸러기 메이트</h1>
          <p className={styles.subtitle}>Tak-kkoorugi Mate · 관리자 로그인</p>
        </div>

        <form onSubmit={handleLogin} className={styles.form}>
          {error && (
            <div className={styles.errorAlert}>
              <AlertCircle size={18} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div className={styles.fieldGroup}>
            <label htmlFor="admin-email" className={styles.label}>
              관리자 이메일
            </label>
            <div className={styles.inputWrapper}>
              <input
                id="admin-email"
                type="email"
                className={styles.input}
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Mail size={18} className={styles.inputIcon} aria-hidden="true" />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="admin-password" className={styles.label}>
              비밀번호
            </label>
            <div className={styles.inputWrapper}>
              <input
                id="admin-password"
                type="password"
                className={styles.input}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Lock size={18} className={styles.inputIcon} aria-hidden="true" />
            </div>
          </div>

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading}
          >
            {loading ? (
              <>
                <LoaderCircle size={20} className={styles.spinner} aria-hidden="true" />
                <span>로그인 중...</span>
              </>
            ) : (
              <>
                <span>로그인</span>
                <ArrowRight size={18} aria-hidden="true" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
