"use client";

import { Search } from "lucide-react";
import Image from "next/image";
import styles from "./Topbar.module.css";

export default function Topbar() {
  return (
    <header className={styles.topbar}>
      <div className={styles.search}>
        <Search size={18} className={styles.icon} />
        <input
          type="text"
          placeholder="Search orders..."
          className={styles.input}
        />
      </div>

      <div className={styles.profile}>
        <div className={styles.info}>
          <p className={styles.name}>Nadun Peiris</p>
          <p className={styles.role}>Administrator</p>
        </div>
        <Image
          src="/images/admin-avatar.jpg"
          width={40}
          height={40}
          alt="Profile"
          className={styles.avatar}
        />
      </div>
    </header>
  );
}
