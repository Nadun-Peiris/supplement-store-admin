"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import Image from "next/image";
import { FirebaseError } from "firebase/app";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { Loader2 } from "lucide-react";
import { FaEnvelope, FaLock } from "react-icons/fa";
import toast from "react-hot-toast";
import { auth } from "@/lib/firebase";

const ADMIN_THEME_STORAGE_KEY = "admin-dashboard-theme";
const LOGIN_SKIP_LOADER_KEY = "admin-login-skip-loader";
const Player = dynamic(
  () => import("@lottiefiles/react-lottie-player").then((mod) => mod.Player),
  { ssr: false }
);

function LoginScreenLoader({ isFading }: { isFading: boolean }) {
  return (
    <div
      className="absolute inset-0 z-20"
      style={{
        opacity: isFading ? 0 : 1,
        transition: "opacity 600ms cubic-bezier(0.4, 0, 0.2, 1)",
        pointerEvents: isFading ? "none" : "auto",
        willChange: "opacity",
      }}
    >
      <div className="flex min-h-screen items-center justify-center bg-[#07131a] px-5 py-6">
        <div className="flex flex-col items-center justify-center">
          <Player
            autoplay
            loop
            src="/animations/loading.json"
            className="h-56 w-56 sm:h-64 sm:w-64"
          />
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
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedTheme = window.localStorage.getItem(ADMIN_THEME_STORAGE_KEY);
    const resolvedTheme = storedTheme === "dark" ? "dark" : "light";
    setTheme(resolvedTheme);
    document.documentElement.setAttribute("data-admin-theme", resolvedTheme);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-admin-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.sessionStorage.getItem(LOGIN_SKIP_LOADER_KEY) === "true") {
      window.sessionStorage.removeItem(LOGIN_SKIP_LOADER_KEY);
      setShowLoader(false);
      setShowForm(true);
      return;
    }

    // Start fade at 1400ms
    const fadeTimer = window.setTimeout(() => {
      setIsLoaderFading(true);
      setShowForm(true);
    }, 1400);

    // Unmount loader 600ms after fade starts (matches transition duration)
    const removeTimer = window.setTimeout(() => {
      setShowLoader(false);
    }, 2000);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
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
        toast.error(
          err.code === "auth/invalid-credential"
            ? "Invalid credentials"
            : "Login failed"
        );
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
        headers: { "Content-Type": "application/json" },
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

  const isDark = theme === "dark";
  const inputClass = `w-full rounded-2xl border px-4 py-3.5 pl-11 text-sm outline-none transition-all placeholder:font-semibold focus:border-[#03c7fe] focus:ring-4 focus:ring-[#03c7fe]/15 ${
    isDark
      ? "border-[#234252] bg-[#10202a] text-[#edf6fa] placeholder:text-[#748894]"
      : "border-[#cfeef7] bg-[#fbfdff] text-[#111] placeholder:text-[#bcc6d3]"
  }`;

  return (
    <main
      className={`relative min-h-screen overflow-hidden ${
        isDark ? "bg-[#07131a]" : "bg-[#f2fbff]"
      }`}
    >
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
                    Keep stock, pricing, and featured placements current in real time.
                  </p>
                </div>
                <div className="rounded-[1.75rem] border border-white/12 bg-white/10 p-5 backdrop-blur-sm">
                  <h3 className="text-sm font-bold text-white">
                    Orders and fulfilment
                  </h3>
                  <p className="mt-2 text-[12px] leading-5 text-white/65">
                    Monitor payments, status changes, and daily operational flow.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex min-h-screen flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-8 lg:px-12 lg:py-10">
          <div
            className={`w-full max-w-[470px] transition-all duration-700 ease-out ${
              showForm
                ? "translate-y-0 scale-100 opacity-100"
                : "translate-y-4 scale-[0.985] opacity-0"
            }`}
          >
            <div
              className={`rounded-[2rem] border px-6 py-10 backdrop-blur-xl sm:px-8 lg:px-10 ${
                isDark
                  ? "border-[#234252] bg-[#0b161ce6] shadow-[0_24px_60px_rgba(0,0,0,0.32)]"
                  : "border-white/80 bg-white/88 shadow-[0_24px_60px_rgba(3,199,254,0.12)]"
              }`}
            >
              <div className="mb-8 text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-[#03c7fe] text-white shadow-[0_10px_30px_rgba(3,199,254,0.3)]">
                  <FaLock size={24} />
                </div>
                <p
                  className={`text-[11px] font-black uppercase tracking-[0.28em] ${
                    isDark ? "text-[#96a9b5]" : "text-[#8ea4b5]"
                  }`}
                >
                  Secure Admin Access
                </p>
                <h1
                  className={`mt-3 text-3xl font-black tracking-tight ${
                    isDark ? "text-[#edf6fa]" : "text-[#111]"
                  }`}
                >
                  {resetMode ? "Reset Password" : "Admin Login"}
                </h1>
                {resetMode ? (
                  <p
                    className={`mt-3 text-sm leading-6 ${
                      isDark ? "text-[#b5c2cb]" : "text-[#6f8190]"
                    }`}
                  >
                    Enter the email tied to your admin account and we will send a reset link.
                  </p>
                ) : null}
              </div>

              <form
                onSubmit={resetMode ? handleForgotPassword : handleLogin}
                className="space-y-4"
              >
                <div>
                  <label
                    className={`mb-2 block text-[10px] font-black uppercase tracking-[0.22em] ${
                      isDark ? "text-[#96a9b5]" : "text-[#a1b2bf]"
                    }`}
                  >
                    Email
                  </label>
                  <div className="relative">
                    <FaEnvelope
                      className={`absolute left-4 top-4 ${
                        isDark ? "text-[#748894]" : "text-[#8ca2b2]"
                      }`}
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
                    <label
                      className={`mb-2 block text-[10px] font-black uppercase tracking-[0.22em] ${
                        isDark ? "text-[#96a9b5]" : "text-[#a1b2bf]"
                      }`}
                    >
                      Password
                    </label>
                    <div className="relative">
                      <FaLock
                        className={`absolute left-4 top-4 ${
                          isDark ? "text-[#748894]" : "text-[#8ca2b2]"
                        }`}
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
        </section>
      </div>
    </main>
  );
}