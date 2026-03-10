"use client";

import { useEffect, useState, type ReactNode } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

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

    // Modern browser support
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    // Fallback for older browsers
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);
  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50 text-gray-900">
      <Sidebar isOpen={isSidebarOpen} closeSidebar={closeSidebar} />

      {/* Mobile Backdrop Overlay */}
      {isSidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 block h-full w-full cursor-default bg-gray-900/50 transition-opacity lg:hidden"
          aria-label="Close sidebar"
          onClick={closeSidebar}
          tabIndex={-1}
        />
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
        <Topbar onToggleSidebar={toggleSidebar} />
        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}