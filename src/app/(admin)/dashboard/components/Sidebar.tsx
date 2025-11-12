"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import styles from "./Sidebar.module.css";

const navItems = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Orders", href: "/dashboard/orders" },
  { name: "Products", href: "/dashboard/products" },
  { name: "Admins", href: "/dashboard/admins" },
  { name: "Users", href: "/dashboard/users" },
  { name: "Reports", href: "/dashboard/reports" },
  { name: "Settings", href: "/dashboard/settings" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <div>
        <h1 className={styles.brand}>Supplement Admin</h1>
        <nav className={styles.nav}>
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`${styles.link} ${
                pathname === item.href ? styles.active : ""
              }`}
            >
              {item.name}
            </Link>
          ))}
        </nav>
      </div>

      <div className={styles.footer}>
        <button className={styles.logout}>
          <LogOut size={18} /> Log out
        </button>
      </div>
    </aside>
  );
}
