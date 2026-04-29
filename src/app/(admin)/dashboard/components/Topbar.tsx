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
    <header className="sticky top-0 z-20 w-full border-b border-[#cfeef7] bg-white/80 backdrop-blur-xl">
      <div className="flex w-full flex-col gap-4 px-4 py-4 sm:px-6 lg:h-20 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-0">
        
        {/* Left Section: Mobile Menu Toggle & Search Bar */}
        <div className="flex w-full flex-1 items-center gap-4 lg:max-w-md">
          {/* Mobile Menu Button */}
          <button
            type="button"
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#cfeef7] bg-white text-[#aaa] shadow-sm transition hover:border-[#03c7fe] hover:text-[#03c7fe] lg:hidden"
            onClick={onToggleSidebar}
            aria-label="Toggle sidebar"
          >
            <Menu size={20} />
          </button>

          {/* Search Input Wrapper */}
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search size={16} className="text-[#aaa]" />
            </div>
            <input
              type="text"
              placeholder="Search orders..."
              className="block w-full rounded-2xl border border-[#cfeef7] bg-[#fbfdff] py-3 pl-10 pr-4 text-xs font-bold text-[#111] outline-none transition focus:border-[#03c7fe] focus:ring-2 focus:ring-[#03c7fe]/20"
            />
          </div>
        </div>

        {/* Right Section: Profile Info */}
        <div className="flex items-center justify-end gap-5">
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-2xl border border-[#cfeef7] bg-white px-5 py-3 text-[10px] font-black uppercase tracking-widest text-[#888] transition hover:bg-[#f2fbff] hover:text-[#111]"
          >
            Log Out
          </button>

          <div className="flex items-center gap-4 border-l border-[#cfeef7] pl-5">
            <div className="flex flex-col text-right">
              <p className="text-xs font-black text-[#111]">{displayName}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">{roleLabel}</p>
            </div>
            
            {/* Initial Avatar */}
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#03c7fe] text-sm font-black text-white shadow-[0_4px_10px_rgba(3,199,254,0.3)]">
              {avatarLabel}
            </div>
          </div>
        </div>

      </div>
    </header>
  );
}