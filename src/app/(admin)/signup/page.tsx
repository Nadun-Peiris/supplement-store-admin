"use client";
import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import styles from "./signup.module.css";

export default function AdminSignup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSignUp = async () => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setSuccess(true);
      setError("");
    } catch (err: any) {
      setError(err.message);
      setSuccess(false);
    }
  };

  return (
    <main className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Admin Sign Up</h1>

        <input
          type="email"
          placeholder="Email"
          className={styles.input}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          className={styles.input}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={handleSignUp} className={styles.button}>
          Sign Up
        </button>

        {error && <p className={styles.error}>{error}</p>}
        {success && (
          <p className={styles.success}>Account created successfully!</p>
        )}
      </div>
    </main>
  );
}
