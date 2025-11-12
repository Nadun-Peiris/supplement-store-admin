"use client";

import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import styles from "./admins.module.css";

export default function ManageAdminsPage() {
  const [email, setEmail] = useState("");
  const [admins, setAdmins] = useState<{ email: string }[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // 🔹 Fetch admins (supports both role & isAdmin field types)
  const fetchAdmins = async () => {
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const adminList: { email: string }[] = [];

      usersSnap.forEach((doc) => {
        const data = doc.data();
        if (data.role === "admin" || data.isAdmin === true) {
          adminList.push({ email: data.email });
        }
      });

      setAdmins(adminList);
    } catch (error) {
      console.error("Error fetching admins:", error);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  // 🔹 Update Firebase role via API route
  const updateRole = async (makeAdmin: boolean) => {
    if (!email.trim()) return setMessage("Please enter an email address.");
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin/set-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, makeAdmin }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(makeAdmin ? "✅ User promoted to Admin!" : "❎ Admin role removed.");
        setEmail("");
        await fetchAdmins(); // 🔄 Auto refresh admin list
      } else {
        setMessage(`⚠️ ${data.error || "Failed to update role."}`);
      }
    } catch {
      setMessage("⚠️ Failed to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={styles.section}>
      <h1 className={styles.heading}>Manage Admins</h1>

      <div className={styles.form}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter user email"
          className={styles.input}
        />
        <div className={styles.buttons}>
          <button
            onClick={() => updateRole(true)}
            disabled={loading}
            className={`${styles.btn} ${styles.addBtn}`}
          >
            Make Admin
          </button>
          <button
            onClick={() => updateRole(false)}
            disabled={loading}
            className={`${styles.btn} ${styles.removeBtn}`}
          >
            Remove Admin
          </button>
        </div>
      </div>

      {message && <p className={styles.message}>{message}</p>}

      <div className={styles.tableWrapper}>
        <h2 className={styles.subHeading}>Current Admins</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {admins.length === 0 ? (
              <tr>
                <td className={styles.empty}>No admins found</td>
              </tr>
            ) : (
              admins.map((admin, index) => (
                <tr key={index}>
                  <td>{admin.email}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
