"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { Menu, Search } from "lucide-react";
import { auth } from "@/lib/firebase";

interface TopbarProps {
  onToggleSidebar: () => void;
}

export default function Topbar({ onToggleSidebar }: TopbarProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("Admin");
  const [role, setRole] = useState<"admin" | "superadmin" | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) return;

      if (firebaseUser.displayName?.trim()) {
        setDisplayName(firebaseUser.displayName);
      } else if (firebaseUser.email) {
        setDisplayName(firebaseUser.email.split("@")[0]);
      }

      try {
        const token = await firebaseUser.getIdToken();
        const res = await fetch("/api/auth/validate-role", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) return;

        const data = await res.json();
        if (data.role === "admin" || data.role === "superadmin") {
          setRole(data.role);
        }
      } catch (error) {
        console.error("Failed to load topbar role:", error);
      }
    });

    return () => unsub();
  }, []);

  const roleLabel = useMemo(() => {
    if (role === "superadmin") return "Superadmin";
    if (role === "admin") return "Administrator";
    return "Administrator";
  }, [role]);

  const avatarLabel = useMemo(
    () => displayName.trim().charAt(0).toUpperCase() || "A",
    [displayName]
  );

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } finally {
      document.cookie = "firebaseToken=; path=/; max-age=0; Secure; SameSite=Strict";
      router.push("/login");
    }
  };

  return (
    <header className="sticky top-0 z-20 w-full border-b border-gray-200 bg-white">
      {/* Uses flex-col on mobile so the search bar sits under the top row, 
        and snaps to a single horizontal row on desktop (lg:flex-row) 
      */}
      <div className="flex w-full flex-col gap-4 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        
        {/* Left Section: Mobile Menu Toggle & Search Bar */}
        <div className="flex w-full flex-1 items-center gap-3 lg:max-w-md">
          {/* Mobile Menu Button */}
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-900 lg:hidden"
            onClick={onToggleSidebar}
            aria-label="Toggle sidebar"
          >
            <Menu size={20} />
          </button>

          {/* Search Input Wrapper */}
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search orders..."
              className="block w-full rounded-lg border border-gray-300 bg-gray-50 py-2 pl-10 pr-3 text-sm text-gray-900 outline-none transition-colors focus:border-[#01C7FE] focus:bg-white focus:ring-1 focus:ring-[#01C7FE]"
            />
          </div>
        </div>

        {/* Right Section: Profile Info */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900"
          >
            Log Out
          </button>

          <div className="flex flex-col text-right">
            <p className="text-sm font-semibold text-gray-900">{displayName}</p>
            <p className="text-xs font-medium text-gray-500">{roleLabel}</p>
          </div>
          
          {/* Initial Avatar */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#01C7FE]/10 text-sm font-bold text-[#01C7FE] ring-1 ring-inset ring-[#01C7FE]/20">
            {avatarLabel}
          </div>
        </div>

      </div>
    </header>
  );
}
