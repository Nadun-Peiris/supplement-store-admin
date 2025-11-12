"use client";

import { useEffect, useState } from "react";
import { updateProfile, updatePassword, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import styles from "./profile.module.css";

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [displayName, setDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // 🔹 Get current logged-in admin
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setDisplayName(firebaseUser?.displayName || "");
    });
    return () => unsub();
  }, []);

  // 🔹 Update display name
  const handleProfileSave = async () => {
    if (!user) return;
    setSaving(true);
    setMessage("");

    try {
      await updateProfile(user, { displayName });
      setMessage("✅ Profile updated successfully!");
    } catch (error) {
      console.error(error);
      setMessage("❌ Error updating profile");
    } finally {
      setSaving(false);
    }
  };

  // 🔹 Change password
  const handlePasswordChange = async () => {
    if (!user) return;
    if (newPassword !== confirmPassword) {
      setMessage("❌ Passwords do not match");
      return;
    }
    setSaving(true);
    setMessage("");

    try {
      await updatePassword(user, newPassword);
      setNewPassword("");
      setConfirmPassword("");
      setMessage("✅ Password changed successfully!");
    } catch (error: any) {
      console.error(error);
      if (error.code === "auth/requires-recent-login") {
        setMessage("⚠️ Please log out and log in again to change password.");
      } else {
        setMessage("❌ Error changing password");
      }
    } finally {
      setSaving(false);
    }
  };

  if (!user)
    return (
      <div className={styles.loading}>
        <p>Loading profile...</p>
      </div>
    );

  return (
    <section className={styles.section}>
      <h1 className={styles.heading}>Profile Settings</h1>

      <div className={styles.form}>
        <label>Email (cannot be changed)</label>
        <input type="email" value={user.email} disabled />

        <label>Display Name</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />

        <button
          onClick={handleProfileSave}
          className={styles.saveBtn}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </div>

      <div className={styles.form}>
        <h2 className={styles.subheading}>Change Password</h2>
        <input
          type="password"
          placeholder="New password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <input
          type="password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <button
          onClick={handlePasswordChange}
          className={styles.saveBtn}
          disabled={saving}
        >
          {saving ? "Updating..." : "Update Password"}
        </button>
      </div>

      {message && <p className={styles.message}>{message}</p>}
    </section>
  );
}
