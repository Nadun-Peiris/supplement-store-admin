"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import styles from "./settings.module.css";

export default function SettingsPage() {
  const [form, setForm] = useState({
    storeName: "",
    address: "",
    contactEmail: "",
    contactNumber: "",
    aboutText: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 🔹 Load settings from Firestore
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "settings", "general");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setForm(docSnap.data() as any);
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // 🔹 Save settings to Firestore
  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "settings", "general"), form);
      alert("✅ Settings saved successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Error saving settings. Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className={styles.loading}>Loading settings...</p>;

  return (
    <section className={styles.section}>
      <h1 className={styles.heading}>Store Settings</h1>

      <div className={styles.form}>
        <label>Store Name</label>
        <input
          type="text"
          value={form.storeName}
          onChange={(e) => setForm({ ...form, storeName: e.target.value })}
        />

        <label>Store Address</label>
        <input
          type="text"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />

        <label>Contact Email</label>
        <input
          type="email"
          value={form.contactEmail}
          onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
        />

        <label>Contact Number</label>
        <input
          type="text"
          value={form.contactNumber}
          onChange={(e) => setForm({ ...form, contactNumber: e.target.value })}
        />

        <label>About Text</label>
        <textarea
          rows={4}
          value={form.aboutText}
          onChange={(e) => setForm({ ...form, aboutText: e.target.value })}
        />

        <button
          onClick={handleSave}
          className={styles.saveBtn}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </section>
  );
}
