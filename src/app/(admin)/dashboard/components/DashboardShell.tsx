"use client";

import { useEffect, useState, type ReactNode } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import styles from "./DashboardShell.module.css";

export default function DashboardShell({
  children,
}: {
  children: ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(min-width: 1024px)");

    const syncSidebar = (matches: boolean) => {
      setIsSidebarOpen(matches);
    };

    syncSidebar(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      syncSidebar(event.matches);
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);
  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className={`${styles.dashboardLayout} bg-slate-50`}>
      <Sidebar isOpen={isSidebarOpen} closeSidebar={closeSidebar} />

      {isSidebarOpen && (
        <button
          type="button"
          className={styles.sidebarOverlay}
          aria-label="Close sidebar"
          onClick={closeSidebar}
        />
      )}

      <div className={`${styles.content} flex flex-col min-h-screen`}>
        <Topbar onToggleSidebar={toggleSidebar} />
        <main className={`${styles.main} px-4 sm:px-6 lg:px-8`}>{children}</main>
      </div>
    </div>
  );
}
