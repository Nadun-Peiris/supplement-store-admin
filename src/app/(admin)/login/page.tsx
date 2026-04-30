"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { FirebaseError } from "firebase/app";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { FaLock, FaEnvelope } from "react-icons/fa";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";

const Player = dynamic(
  () => import("@lottiefiles/react-lottie-player").then((mod) => mod.Player),
  { ssr: false }
);

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showLoader, setShowLoader] = useState(true);
  const [isLoaderFading, setIsLoaderFading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const loaderTimer = window.setTimeout(() => {
      setIsLoaderFading(true);
      setShowForm(true);
    }, 2500);
    const removeLoaderTimer = window.setTimeout(() => {
      setShowLoader(false);
    }, 3000);

    return () => {
      window.clearTimeout(loaderTimer);
      window.clearTimeout(removeLoaderTimer);
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const credentials = await signInWithEmailAndPassword(auth, email, password);
      const token = await credentials.user.getIdToken();

      const roleCheckResponse = await fetch("/api/auth/validate-role", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!roleCheckResponse.ok) {
        await signOut(auth);
        toast.error("Access denied. Admin privileges required.");
        return;
      }

      const sessionResponse = await fetch("/api/auth/session", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!sessionResponse.ok) {
        await signOut(auth);
        toast.error("Failed to start admin session.");
        return;
      }

      window.location.href = "/dashboard";
    } catch (err: unknown) {
      if (err instanceof FirebaseError) {
        toast.error(err.code === "auth/invalid-credential" ? "Invalid credentials" : "Login failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      toast.error("Please enter your email");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: trimmedEmail }),
      });

      const data = (await response.json().catch(() => null)) as
        | { message?: string; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(data?.error || "Failed to send reset link");
      }

      toast.success(data?.message || "Reset link sent to your inbox!");
      setResetMode(false);
    } catch (err) {
      if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error("Failed to send reset link");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full rounded-xl border border-[#cfeef7] bg-[#fbfdff] p-3 pl-10 text-sm text-[#111] outline-none transition-all placeholder:font-semibold placeholder:text-[#bcc6d3] focus:border-[#03c7fe] focus:ring-2 focus:ring-[#03c7fe]/20";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f2fbff] px-4">
      {showLoader ? (
        <div
          className={`absolute inset-0 z-10 flex items-center justify-center bg-[#f2fbff] transition-opacity duration-500 ${
            isLoaderFading ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          <Player autoplay loop src="/animations/loading.json" className="h-64 w-64" />
        </div>
      ) : null}

      <div className={`w-full max-w-[420px] rounded-[32px] border border-white bg-white/80 p-10 shadow-[0_20px_50px_rgba(3,199,254,0.1)] backdrop-blur-xl transition-all duration-500 ${showForm ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}>
        
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#03c7fe] text-white shadow-[0_8px_20px_rgba(3,199,254,0.3)]">
            <FaLock size={24} />
          </div>
          <h1 className="text-2xl font-black text-[#111]">{resetMode ? "Reset Password" : "Admin Login"}</h1>
        </div>

        <form onSubmit={resetMode ? handleForgotPassword : handleLogin} className="space-y-4">
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-[#bcc6d3]">
              Email
            </label>
            <div className="relative">
              <FaEnvelope className="absolute left-3.5 top-3.5 text-gray-400" size={14} />
              <input type="email" placeholder="Email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>

          {!resetMode && (
            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-[#bcc6d3]">
                Password
              </label>
              <div className="relative">
                <FaLock className="absolute left-3.5 top-3.5 text-gray-400" size={14} />
                <input type="password" placeholder="Password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </div>
          )}

          <button type="submit" disabled={submitting} className="w-full rounded-2xl bg-[#03c7fe] py-4 text-sm font-black text-white shadow-[0_10px_25px_rgba(3,199,254,0.3)] transition-all hover:scale-[1.02] disabled:opacity-50">
            {submitting ? <Loader2 className="mx-auto animate-spin" /> : (resetMode ? "Send Reset Link" : "Sign In")}
          </button>
        </form>

        <button onClick={() => setResetMode(!resetMode)} className="mt-6 w-full text-center text-xs font-bold text-[#03c7fe] hover:underline">
          {resetMode ? "← Back to Login" : "Forgot Password?"}
        </button>
      </div>
    </main>
  );
}
