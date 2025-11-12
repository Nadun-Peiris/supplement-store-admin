"use client";

import Sidebar from "./Sidebar";
import styles from "./DashboardShell.module.css";

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.dashboardLayout}>
      <Sidebar />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
