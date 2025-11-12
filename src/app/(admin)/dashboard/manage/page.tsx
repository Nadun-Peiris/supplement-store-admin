"use client";

import { useState } from "react";
import styles from "./manage.module.css";

export default function ManageAdminsPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  const updateRole = async (makeAdmin: boolean) => {
    setLoading(true);
    setMessage("");
    setIsError(false);
    try {
      const res = await fetch("/api/admin/set-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, makeAdmin }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
      } else {
        setMessage(data.error || "Something went wrong");
        setIsError(true);
      }
    } catch {
      setMessage("Network error. Please try again.");
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={`${styles.container} px-4`}>
      <div className={`${styles.card} w-full max-w-md`}>
        <h1 className={styles.title}>Manage Admins</h1>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter user email"
          className={styles.input}
        />
        <div
          className={`${styles.buttonGroup} flex-col gap-3 sm:flex-row sm:items-center`}
        >
          <button
            onClick={() => updateRole(true)}
            disabled={loading}
            className={`${styles.button} ${styles.makeBtn} w-full sm:w-auto`}
          >
            {loading ? "Processing..." : "Make Admin"}
          </button>
          <button
            onClick={() => updateRole(false)}
            disabled={loading}
            className={`${styles.button} ${styles.removeBtn} w-full sm:w-auto`}
          >
            {loading ? "Processing..." : "Remove Admin"}
          </button>
        </div>
        {message && (
          <p className={`${styles.message} ${isError ? styles.error : styles.success}`}>
            {message}
          </p>
        )}
      </div>
    </main>
  );
}
