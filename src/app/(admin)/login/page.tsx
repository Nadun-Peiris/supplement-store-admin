"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { FirebaseError } from "firebase/app";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import styles from "./login.module.css";

// ✅ Dynamically import Lottie Player (client-only)
const Player = dynamic(
  () => import("@lottiefiles/react-lottie-player").then((mod) => mod.Player),
  { ssr: false }
);

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // 🌀 Loader transition animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
      setTimeout(() => setShowForm(true), 300);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // 🔹 Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      // Firebase Auth login
      const credentials = await signInWithEmailAndPassword(auth, email, password);

      // ✅ Get Firebase ID token
      const token = await credentials.user.getIdToken();

      // ✅ Validate role before allowing dashboard access
      const roleCheckResponse = await fetch("/api/auth/validate-role", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!roleCheckResponse.ok) {
        await signOut(auth);
        document.cookie =
          "firebaseToken=; path=/; max-age=0; Secure; SameSite=Strict";
        setError("❌ Not allowed. Only admin or superadmin can log in.");
        return;
      }

      // ✅ Store token in secure cookie for middleware auth
      if (token) {
        document.cookie = `firebaseToken=${token}; path=/; max-age=3600; Secure; SameSite=Strict`;
      }

      // Redirect to dashboard
      window.location.href = "/dashboard";
    } catch (err: unknown) {
      if (err instanceof FirebaseError) {
        if (err.code === "auth/invalid-credential") {
          setError("❌ Invalid email or password.");
          return;
        }

        if (err.code === "auth/too-many-requests") {
          setError("❌ Too many attempts. Please try again later.");
          return;
        }

        if (err.code === "auth/user-disabled") {
          setError("❌ This account is disabled.");
          return;
        }
      }

      console.error("Login error:", err);
      setError("❌ Login failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // 🔹 Handle password reset
  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email to reset password.");
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("✅ Password reset link sent. Check your inbox.");
    } catch {
      setError("❌ Failed to send reset link. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.main}>
      {/* 🌀 Loading Animation */}
      {loading && (
        <div
          className={`${styles.loaderWrapper} ${
            !loading ? styles.fadeOut : ""
          }`}
        >
          <Player
            autoplay
            loop
            src="/animations/loading.json" // ensure this file is in /public/animations/
            className={styles.lottiePlayer}
          />
        </div>
      )}

      {/* 🔐 Login / Reset Form */}
      {showForm && (
        <form
          onSubmit={handleLogin}
          className={`${styles.form} ${showForm ? styles.fadeIn : ""}`}
        >
          <h1 className={styles.title}>
            {resetMode ? "Reset Password" : "Admin Login"}
          </h1>

          {/* Email */}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={styles.input}
            required
          />

          {/* Password */}
          {!resetMode && (
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              required
            />
          )}

          {/* Buttons */}
          {resetMode ? (
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={submitting}
              className={styles.submitBtn}
            >
              {submitting ? "Sending..." : "Send Reset Link"}
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className={styles.submitBtn}
            >
              {submitting ? "Logging in..." : "Login"}
            </button>
          )}

          {/* Forgot Password Toggle */}
          <p className={styles.forgotText}>
            <button
              type="button"
              onClick={() => setResetMode(!resetMode)}
              className={styles.forgotLink}
            >
              {resetMode ? "← Back to Login" : "Forgot Password?"}
            </button>
          </p>

          {/* Feedback */}
          {error && <p className={styles.error}>{error}</p>}
          {message && <p className={styles.success}>{message}</p>}
        </form>
      )}
    </main>
  );
}
