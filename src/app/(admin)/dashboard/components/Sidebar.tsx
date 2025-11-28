"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, X } from "lucide-react";
import styles from "./Sidebar.module.css";

const navItems = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Orders", href: "/dashboard/orders" },
  { name: "Products", href: "/dashboard/products" },
  { name: "Admins", href: "/dashboard/admins" },
  { name: "Users", href: "/dashboard/users" },
  { name: "Reports", href: "/dashboard/reports" },
  { name: "Profile", href: "/dashboard/profile" },
  { name: "Web Management", href: "/dashboard/webmanagement" },
  { name: "Settings", href: "/dashboard/settings" },
];

interface SidebarProps {
  isOpen: boolean;
  closeSidebar: () => void;
}

export default function Sidebar({ isOpen, closeSidebar }: SidebarProps) {
  const pathname = usePathname();
  const handleNavigate = () => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      closeSidebar();
    }
  };

  return (
    <aside
      className={`${styles.sidebar} ${isOpen ? styles.open : ""}`}
    >
      <div className={styles.mobileHeader}>
        <h1 className={styles.brand}>Supplement Admin</h1>

        {/* 👇 Close button (visible only on mobile) */}
        <button
          type="button"
          className={styles.closeSidebarBtn}
          aria-label="Close sidebar"
          onClick={closeSidebar}
        >
          <X size={18} />
        </button>
      </div>

      <div className={styles.sidebarBody}>
        <nav className={styles.nav}>
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`${styles.link} ${
                pathname === item.href ? styles.active : ""
              }`}
              onClick={handleNavigate}
            >
              {item.name}
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}
