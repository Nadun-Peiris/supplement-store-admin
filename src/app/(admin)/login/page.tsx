"use client";

import { useState, useEffect } from "react";
import { FirebaseError } from "firebase/app";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Image from "next/image";
import { FaLock, FaEnvelope } from "react-icons/fa";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";

function LoginScreenLoader({ isFading }: { isFading: boolean }) {
  return (
    <div
      className={`absolute inset-0 z-20 transition-opacity duration-500 ${
        isFading ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex min-h-screen items-center bg-[#f2fbff] px-5 py-6 lg:p-6">
        <div className="mx-auto flex w-full max-w-[1280px] items-stretch overflow-hidden rounded-[2rem] border border-white/70 bg-white/55 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur-sm lg:min-h-[calc(100vh-3rem)]">
          <div className="hidden lg:flex lg:w-[48%] flex-col justify-between bg-[linear-gradient(160deg,#04131d_0%,#0f3e55_45%,#03c7fe_140%)] p-12 text-white">
            <div className="space-y-6">
              <div className="h-8 w-28 rounded-full bg-white/15 animate-pulse" />
              <div className="space-y-3">
                <div className="h-5 w-40 rounded-full bg-white/12 animate-pulse" />
                <div className="h-14 w-[82%] rounded-[1.5rem] bg-white/12 animate-pulse" />
                <div className="h-14 w-[68%] rounded-[1.5rem] bg-white/12 animate-pulse" />
              </div>
              <div className="h-4 w-[72%] rounded-full bg-white/10 animate-pulse" />
            </div>
            <div className="space-y-3">
              <div className="h-24 rounded-[1.75rem] border border-white/10 bg-white/10 animate-pulse" />
              <div className="h-24 rounded-[1.75rem] border border-white/10 bg-white/10 animate-pulse" />
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(3,199,254,0.12),_transparent_50%),linear-gradient(180deg,_rgba(255,255,255,0.95)_0%,_rgba(244,251,255,0.88)_100%)] px-6 py-10 sm:px-8 lg:px-12">
            <div className="w-full max-w-[430px] rounded-[2rem] border border-white/80 bg-white/85 p-8 shadow-[0_20px_60px_rgba(3,199,254,0.12)] backdrop-blur-xl sm:p-10">
              <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-[1.35rem] bg-[#03c7fe] text-white shadow-[0_10px_30px_rgba(3,199,254,0.32)]">
                <Loader2 size={24} className="animate-spin" />
              </div>
              <div className="space-y-3 text-center">
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#8ea4b5]">
                  Admin Access
                </p>
                <h2 className="text-2xl font-black tracking-tight text-[#111]">
                  Preparing secure sign in
                </h2>
                <p className="text-sm leading-6 text-[#667a89]">
                  Loading the admin workspace and authentication checks.
                </p>
              </div>
              <div className="mt-8 space-y-3">
                <div className="h-12 rounded-2xl bg-[#eef8fc] animate-pulse" />
                <div className="h-12 rounded-2xl bg-[#eef8fc] animate-pulse" />
                <div className="h-14 rounded-2xl bg-[#c9f3ff] animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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
    }, 1100);
    const removeLoaderTimer = window.setTimeout(() => {
      setShowLoader(false);
    }, 1500);

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

  const inputClass =
    "w-full rounded-2xl border border-[#cfeef7] bg-[#fbfdff] px-4 py-3.5 pl-11 text-sm text-[#111] outline-none transition-all placeholder:font-semibold placeholder:text-[#bcc6d3] focus:border-[#03c7fe] focus:ring-4 focus:ring-[#03c7fe]/15";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f2fbff]">
      {showLoader ? <LoginScreenLoader isFading={isLoaderFading} /> : null}

      <div className="relative flex min-h-screen items-stretch">
        <section className="hidden lg:flex lg:w-[48%] lg:flex-col lg:justify-between lg:overflow-hidden lg:rounded-r-[2.25rem] lg:bg-[#03141d] lg:text-white">
          <div className="relative flex-1">
            <Image
              src="/loginbanner.jpg"
              alt="Login banner"
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,14,22,0.36)_0%,rgba(2,14,22,0.74)_100%)]" />

            <div className="relative z-10 flex h-full flex-col justify-between p-12">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-white">
                  Supplement Lanka Admin
                </div>
                <h1 className="mt-10 max-w-md text-[3rem] font-black leading-[1.02] tracking-tight">
                  Command your store
                  <br />
                  from one secure
                  <br />
                  workspace.
                </h1>
                <p className="mt-5 max-w-sm text-[15px] leading-7 text-white/72">
                  Review orders, refresh inventory, and keep the admin team in
                  sync without leaving the dashboard.
                </p>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-[1.75rem] border border-white/12 bg-white/10 p-5 backdrop-blur-sm">
                  <h3 className="text-sm font-bold text-white">
                    Product and inventory
                  </h3>
                  <p className="mt-2 text-[12px] leading-5 text-white/65">
                    Keep stock, pricing, and featured placements current in
                    real time.
                  </p>
                </div>
                <div className="rounded-[1.75rem] border border-white/12 bg-white/10 p-5 backdrop-blur-sm">
                  <h3 className="text-sm font-bold text-white">
                    Orders and fulfilment
                  </h3>
                  <p className="mt-2 text-[12px] leading-5 text-white/65">
                    Monitor payments, status changes, and daily operational
                    flow.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex min-h-screen flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-8 lg:px-12 lg:py-10">
          <div
            className={`w-full max-w-[470px] transition-all duration-500 ${
              showForm ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            }`}
          >
            <div className="rounded-[2rem] border border-white/80 bg-white/88 px-6 py-10 shadow-[0_24px_60px_rgba(3,199,254,0.12)] backdrop-blur-xl sm:px-8 lg:px-10">
              <div className="mb-8 text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-[#03c7fe] text-white shadow-[0_10px_30px_rgba(3,199,254,0.3)]">
                  <FaLock size={24} />
                </div>
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#8ea4b5]">
                  Secure Admin Access
                </p>
                <h1 className="mt-3 text-3xl font-black tracking-tight text-[#111]">
                  {resetMode ? "Reset Password" : "Admin Login"}
                </h1>
                {resetMode ? (
                  <p className="mt-3 text-sm leading-6 text-[#6f8190]">
                    Enter the email tied to your admin account and we will send
                    a reset link.
                  </p>
                ) : null}
              </div>

              <div>
                <form
                  onSubmit={resetMode ? handleForgotPassword : handleLogin}
                  className="space-y-4"
                >
                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-[#a1b2bf]">
                      Email
                    </label>
                    <div className="relative">
                      <FaEnvelope
                        className="absolute left-4 top-4 text-[#8ca2b2]"
                        size={14}
                      />
                      <input
                        type="email"
                        placeholder="admin@example.com"
                        className={inputClass}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        required
                      />
                    </div>
                  </div>

                  {!resetMode && (
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-[#a1b2bf]">
                        Password
                      </label>
                      <div className="relative">
                        <FaLock
                          className="absolute left-4 top-4 text-[#8ca2b2]"
                          size={14}
                        />
                        <input
                          type="password"
                          placeholder="Enter your password"
                          className={inputClass}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          autoComplete="current-password"
                          required
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-[1.25rem] bg-[#03c7fe] py-4 text-sm font-black text-white shadow-[0_14px_30px_rgba(3,199,254,0.28)] transition-all hover:scale-[1.02] hover:bg-[#02b8ea] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="mx-auto animate-spin" />
                    ) : resetMode ? (
                      "Send Reset Link"
                    ) : (
                      "Sign In"
                    )}
                  </button>
                </form>

                <button
                  onClick={() => setResetMode(!resetMode)}
                  className="mt-6 w-full text-center text-xs font-bold text-[#03c7fe] hover:underline"
                >
                  {resetMode ? "Back to Login" : "Forgot Password?"}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
