import type { ReactNode } from "react";

import styles from "./PublicMatchesSection.module.css";

interface Props {
  title: string;
  count: number;
  children: ReactNode;
}

export default function PublicMatchGroup({
  title,
  count,
  children,
}: Props) {
  if (count === 0) {
    return null;
  }

  return (
    <section className={styles.matchGroup}>
      <header className={styles.matchGroupHeader}>
        <h3>{title}</h3>
        <span>{count}</span>
      </header>

      <div className={styles.matchList}>{children}</div>
    </section>
  );
}
