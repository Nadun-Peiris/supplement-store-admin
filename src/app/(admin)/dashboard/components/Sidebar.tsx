"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

const navItems = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Orders", href: "/dashboard/orders" },
  { name: "Subscriptions", href: "/dashboard/subscriptions" },
  { name: "Products", href: "/dashboard/products" },
  { name: "Categories", href: "/dashboard/categories" },
  { name: "Brands", href: "/dashboard/brands" },
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
  const [role, setRole] = useState<"admin" | "superadmin" | null>(null);

  useEffect(() => {
    const getToken = () =>
      document.cookie
        .split("; ")
        .find((row) => row.startsWith("firebaseToken="))
        ?.split("=")[1];

    const loadRole = async () => {
      try {
        const token = getToken();
        if (!token) return;

        const res = await fetch("/api/auth/validate-role", {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) return;

        const data = await res.json();
        if (data.role === "admin" || data.role === "superadmin") {
          setRole(data.role);
        }
      } catch (error) {
        console.error("Failed to load sidebar role:", error);
      }
    };

    loadRole();
  }, []);

  const visibleNavItems = navItems.filter(
    (item) => item.href !== "/dashboard/admins" || role === "superadmin"
  );

  const handleNavigate = () => {
    // Closes sidebar automatically on mobile/tablet after clicking a link
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      closeSidebar();
    }
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* Sidebar Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 px-6">
        <h1 className="text-lg font-extrabold tracking-tight text-gray-900">
          Supplement Admin
        </h1>

        {/* Close button (visible only on mobile: lg:hidden) */}
        <button
          type="button"
          className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 lg:hidden"
          aria-label="Close sidebar"
          onClick={closeSidebar}
        >
          <X size={20} />
        </button>
      </div>

      {/* Sidebar Navigation Body */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <nav className="flex flex-col gap-1.5">
          {visibleNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[#01C7FE]/10 text-[#01C7FE]"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
                onClick={handleNavigate}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
