"use client";

import { Menu, Search } from "lucide-react";
import Image from "next/image";
import styles from "./Topbar.module.css";

interface TopbarProps {
  onToggleSidebar: () => void;
}

export default function Topbar({ onToggleSidebar }: TopbarProps) {
  return (
    <header
      className={`${styles.topbar} sticky top-0 z-20 w-full border-b border-slate-100/70 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80`}
    >
      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex w-full items-center gap-3">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900 lg:hidden"
            onClick={onToggleSidebar}
            aria-label="Toggle sidebar"
          >
            <Menu size={18} />
          </button>

          <div className={`${styles.search} flex-1`}>
            <Search size={18} className={styles.icon} />
            <input
              type="text"
              placeholder="Search orders..."
              className={`${styles.input} w-full`}
            />
          </div>
        </div>

        <div className={`${styles.profile} justify-between gap-3 sm:justify-end`}>
          <div className={styles.info}>
            <p className={styles.name}>Nadun Peiris</p>
            <p className={styles.role}>Administrator</p>
          </div>
        </div>
      </div>
    </header>
  );
}
