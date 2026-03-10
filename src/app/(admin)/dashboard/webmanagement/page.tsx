"use client";

import Link from "next/link";
import styles from "./webmanagement.module.css";

export default function WebsiteManagementPage() {
  return (
    <section className={styles.section}>
      <div className={styles.tabs}>
        <Link
          href="/dashboard/webmanagement/featured-categories"
          className={styles.tabLink}
        >
          Featured Categories
        </Link>
      </div>
    </section>
  );
}
