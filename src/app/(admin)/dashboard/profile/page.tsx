"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { onAuthStateChanged, updateProfile, type User } from "firebase/auth";
import { adminFetch } from "@/lib/adminClient";
import {
  Activity,
  BadgeCheck,
  CalendarDays,
  Clock3,
  HeartPulse,
  Home,
  KeyRound,
  Mail,
  ShieldCheck,
  User as UserIcon,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { auth } from "@/lib/firebase";

/* ─── Shared UI Component ────────────────────────────────────────── */
function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[28px] border border-white bg-white/80 backdrop-blur-xl shadow-[0_20px_50px_rgba(3,199,254,0.08)] ${className}`}>
      {children}
    </div>
  );
}

const inputClass = "w-full rounded-2xl border border-[#cfeef7] bg-[#fbfdff] px-4 py-3 text-sm font-bold text-[#111] outline-none transition-colors focus:border-[#03c7fe] focus:ring-2 focus:ring-[#03c7fe]/20 disabled:opacity-60 disabled:bg-gray-50";

type Role = "admin" | "superadmin" | "customer";

type AdminProfile = {
  _id: string;
  firebaseId: string | null;
  fullName: string;
  email: string;
  phone: string;
  age: number | null;
  gender: string;
  height: number | null;
  weight: number | null;
  bmi: number | null;
  goal: string;
  activity: string;
  conditions: string;
  diet: string;
  sleepHours: number | null;
  waterIntake: number | null;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  country: string;
  role: Role;
  isBlocked: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

type ProfileForm = {
  fullName: string;
  phone: string;
  age: string;
  gender: string;
  height: string;
  weight: string;
  bmi: string;
  goal: string;
  activity: string;
  conditions: string;
  diet: string;
  sleepHours: string;
  waterIntake: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  country: string;
};

type Banner = {
  tone: "success" | "error";
  text: string;
};

const genderOptions = ["Male", "Female", "Other"];
const goalOptions = ["", "Weight Loss", "Muscle Gain", "Maintenance", "Body Transformation"];
const activityOptions = ["", "Sedentary", "Light", "Moderate", "Active", "Very Active"];
const dietOptions = ["", "Standard", "Vegetarian", "Vegan", "Keto", "Paleo"];

const emptyForm: ProfileForm = {
  fullName: "",
  phone: "",
  age: "",
  gender: "Other",
  height: "",
  weight: "",
  bmi: "",
  goal: "",
  activity: "",
  conditions: "",
  diet: "",
  sleepHours: "",
  waterIntake: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  postalCode: "",
  country: "Sri Lanka",
};

const formatDate = (value: string | null) => {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const toInputValue = (value: number | null) => (value === null ? "" : String(value));

const toFormState = (profile: AdminProfile): ProfileForm => ({
  fullName: profile.fullName,
  phone: profile.phone,
  age: toInputValue(profile.age),
  gender: profile.gender || "Other",
  height: toInputValue(profile.height),
  weight: toInputValue(profile.weight),
  bmi: toInputValue(profile.bmi),
  goal: profile.goal || "",
  activity: profile.activity || "",
  conditions: profile.conditions || "",
  diet: profile.diet || "",
  sleepHours: toInputValue(profile.sleepHours),
  waterIntake: toInputValue(profile.waterIntake),
  addressLine1: profile.addressLine1,
  addressLine2: profile.addressLine2 || "",
  city: profile.city,
  postalCode: profile.postalCode,
  country: profile.country,
});

export default function ProfilePage() {
  const [authUser, setAuthUser] = useState<User | null | undefined>(undefined);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthUser(firebaseUser);

      if (!firebaseUser) {
        setProfile(null);
        setForm(emptyForm);
        setLoading(false);
        return;
      }

      try {
        const response = await adminFetch("/api/admin/profile");

        const data = (await response.json()) as
          | { user: AdminProfile }
          | { error?: string };

        if (!response.ok || !("user" in data)) {
          const errorMessage =
            "error" in data && typeof data.error === "string"
              ? data.error
              : "Failed to load profile";
          throw new Error(errorMessage);
        }

        setProfile(data.user);
        setForm(toFormState(data.user));
      } catch (error) {
        console.error("Failed to load profile:", error);
        setBanner({
          tone: "error",
          text: error instanceof Error ? error.message : "Failed to load profile.",
        });
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const initials = useMemo(() => {
    const source = form.fullName.trim() || authUser?.displayName?.trim() || authUser?.email || "Admin";
    return source.charAt(0).toUpperCase();
  }, [authUser?.displayName, authUser?.email, form.fullName]);

  const roleLabel = useMemo(() => {
    if (profile?.role === "superadmin") return "Superadmin";
    if (profile?.role === "admin") return "Administrator";
    return "Account";
  }, [profile?.role]);

  const headerName = form.fullName.trim() || authUser?.displayName?.trim() || authUser?.email?.split("@")[0] || "Admin";

  const accountAgeLabel = useMemo(() => {
    if (!profile?.createdAt) return "Unknown";
    const createdAt = new Date(profile.createdAt);
    if (Number.isNaN(createdAt.getTime())) return "Unknown";
    const diffMs = Date.now() - createdAt.getTime();
    const diffDays = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? "" : "s"}`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? "" : "s"}`;
    const diffYears = Math.floor(diffMonths / 12);
    return `${diffYears} year${diffYears === 1 ? "" : "s"}`;
  }, [profile?.createdAt]);

  const handleFieldChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleProfileSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authUser) return;
    setSavingProfile(true);
    setBanner(null);

    try {
      const response = await adminFetch("/api/admin/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          age: Number(form.age),
          height: form.height,
          weight: form.weight,
          bmi: form.bmi,
          sleepHours: form.sleepHours,
          waterIntake: form.waterIntake,
        }),
      });

      const data = (await response.json()) as
        | { user: AdminProfile; message?: string }
        | { error?: string };

      if (!response.ok || !("user" in data)) {
        const errorMessage =
          "error" in data && typeof data.error === "string"
            ? data.error
            : "Failed to update profile";
        throw new Error(errorMessage);
      }

      if (authUser.displayName !== form.fullName.trim()) {
        await updateProfile(authUser, { displayName: form.fullName.trim() });
      }

      setProfile(data.user);
      setForm(toFormState(data.user));
      setBanner({
        tone: "success",
        text: data.message || "Profile updated successfully.",
      });
      setTimeout(() => setBanner(null), 4000);
    } catch (error) {
      console.error("Failed to save profile:", error);
      setBanner({
        tone: "error",
        text: error instanceof Error ? error.message : "Failed to save profile.",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authUser) return;
    setSavingPassword(true);
    setBanner(null);

    try {
      const email = (profile?.email || authUser.email || "").trim();

      if (!email) {
        throw new Error("No email address is available for this account.");
      }

      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = (await response.json().catch(() => null)) as
        | { message?: string; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(data?.error || "Failed to send reset link");
      }

      setBanner({
        tone: "success",
        text: data?.message || "Reset link sent to your inbox!",
      });
      setTimeout(() => setBanner(null), 4000);
    } catch (error) {
      console.error("Failed to send reset link:", error);
      setBanner({
        tone: "error",
        text: error instanceof Error ? error.message : "Failed to send reset link.",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading || authUser === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f2fbff]">
        <div className="flex flex-col items-center gap-4">
          <UserIcon size={32} className="animate-pulse text-[#03c7fe]" />
          <h2 className="text-xs font-black uppercase tracking-widest text-[#888]">Loading Profile...</h2>
        </div>
      </main>
    );
  }

  if (!authUser) {
    return (
      <main className="flex min-h-[80vh] items-center justify-center bg-[#f2fbff] px-4">
        <Panel className="flex max-w-sm flex-col items-center p-8 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
            <ShieldCheck size={32} />
          </div>
          <h1 className="mb-2 text-xl font-black text-[#111]">No active session</h1>
          <p className="text-xs font-bold text-[#888]">Sign in again to manage your admin profile.</p>
        </Panel>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f2fbff] px-4 py-8 md:px-8">
      
      {/* Floating Banner */}
      {banner && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
          <div className={`pointer-events-auto flex items-center gap-3 rounded-2xl px-5 py-3 text-xs font-black text-white shadow-[0_10px_25px_rgba(0,0,0,0.1)] transition-all animate-in slide-in-from-right-8 ${
              banner.tone === "success" ? "bg-emerald-500" : "bg-red-500"
          }`}>
            {banner.tone === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {banner.text}
          </div>
        </div>
      )}

      {/* Hero Panel */}
      <Panel className="mb-6 flex flex-col gap-6 p-7 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#03c7fe] text-2xl font-black text-white shadow-[0_8px_20px_rgba(3,199,254,0.3)]">
            {initials}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Admin Account Settings</p>
            <h1 className="text-2xl font-black text-[#111]">{headerName}</h1>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 rounded-2xl border border-[#cfeef7] bg-white px-5 py-3 text-[10px] font-black uppercase tracking-widest text-[#111]">
            <BadgeCheck size={14} className="text-[#03c7fe]" /> {roleLabel}
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-[#cfeef7] bg-white px-5 py-3 text-[10px] font-black uppercase tracking-widest text-[#111]">
            <Mail size={14} className="text-[#03c7fe]" /> {profile?.email || authUser.email || "No email"}
          </div>
        </div>
      </Panel>

      {/* Stats Grid */}
      <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <Panel className="flex flex-col p-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f2fbff] text-[#03c7fe]">
            <ShieldCheck size={20} strokeWidth={2.5} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#aaa]">Role</p>
          <h3 className="mt-1 text-lg font-black text-[#111]">{roleLabel}</h3>
        </Panel>

        <Panel className="flex flex-col p-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f2fbff] text-[#03c7fe]">
            <CalendarDays size={20} strokeWidth={2.5} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#aaa]">Joined</p>
          <h3 className="mt-1 text-lg font-black text-[#111]">{formatDate(profile?.createdAt || null)}</h3>
        </Panel>

        <Panel className="flex flex-col p-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f2fbff] text-[#03c7fe]">
            <Clock3 size={20} strokeWidth={2.5} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#aaa]">Account Age</p>
          <h3 className="mt-1 text-lg font-black text-[#111]">{accountAgeLabel}</h3>
        </Panel>

        <Panel className="flex flex-col p-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f2fbff] text-[#03c7fe]">
            <Activity size={20} strokeWidth={2.5} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#aaa]">Last Updated</p>
          <h3 className="mt-1 text-lg font-black text-[#111]">{formatDate(profile?.updatedAt || null)}</h3>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Main Form Area */}
        <Panel className="col-span-1 lg:col-span-2 p-6 md:p-8">
          <form onSubmit={handleProfileSave}>
            
            {/* Personal Details */}
            <div className="mb-8">
              <h2 className="mb-6 flex items-center gap-2 border-b border-[#e0f4fb] pb-4 text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
                <UserIcon size={14} /> Personal Details
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Full Name</label>
                  <input name="fullName" value={form.fullName} onChange={handleFieldChange} required className={inputClass} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Email Address</label>
                  <input value={profile?.email || authUser.email || ""} disabled className={inputClass} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Phone Number</label>
                  <input name="phone" value={form.phone} onChange={handleFieldChange} required className={inputClass} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Age</label>
                  <input name="age" type="number" min="0" value={form.age} onChange={handleFieldChange} required className={inputClass} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Gender</label>
                  <select name="gender" value={form.gender} onChange={handleFieldChange} required className={inputClass}>
                    {genderOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Diet Preference</label>
                  <select name="diet" value={form.diet} onChange={handleFieldChange} className={inputClass}>
                    {dietOptions.map((opt) => <option key={opt || "none"} value={opt}>{opt || "Not set"}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Primary Goal</label>
                  <select name="goal" value={form.goal} onChange={handleFieldChange} className={inputClass}>
                    {goalOptions.map((opt) => <option key={opt || "none"} value={opt}>{opt || "Not set"}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Activity Level</label>
                  <select name="activity" value={form.activity} onChange={handleFieldChange} className={inputClass}>
                    {activityOptions.map((opt) => <option key={opt || "none"} value={opt}>{opt || "Not set"}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Height (cm)</label>
                  <input name="height" type="number" min="0" step="0.1" value={form.height} onChange={handleFieldChange} className={inputClass} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Weight (kg)</label>
                  <input name="weight" type="number" min="0" step="0.1" value={form.weight} onChange={handleFieldChange} className={inputClass} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">BMI</label>
                  <input name="bmi" type="number" min="0" step="0.1" value={form.bmi} onChange={handleFieldChange} className={inputClass} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Sleep Hours</label>
                  <input name="sleepHours" type="number" min="0" step="0.1" value={form.sleepHours} onChange={handleFieldChange} className={inputClass} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Water Intake (L)</label>
                  <input name="waterIntake" type="number" min="0" step="0.1" value={form.waterIntake} onChange={handleFieldChange} className={inputClass} />
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Medical Conditions / Notes</label>
                  <textarea name="conditions" rows={3} value={form.conditions} onChange={handleFieldChange} placeholder="Add any personal notes..." className={`${inputClass} resize-y`} />
                </div>
              </div>
            </div>

            {/* Address Details */}
            <div className="mb-8">
              <h2 className="mb-6 flex items-center gap-2 border-b border-[#e0f4fb] pb-4 text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
                <Home size={14} /> Billing & Contact Address
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Address Line 1</label>
                  <input name="addressLine1" value={form.addressLine1} onChange={handleFieldChange} required className={inputClass} />
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Address Line 2</label>
                  <input name="addressLine2" value={form.addressLine2} onChange={handleFieldChange} className={inputClass} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">City</label>
                  <input name="city" value={form.city} onChange={handleFieldChange} required className={inputClass} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Postal Code</label>
                  <input name="postalCode" value={form.postalCode} onChange={handleFieldChange} required className={inputClass} />
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Country</label>
                  <input name="country" value={form.country} onChange={handleFieldChange} required className={inputClass} />
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-[#e0f4fb] pt-6">
              <button type="submit" disabled={savingProfile} className="rounded-2xl bg-[#03c7fe] px-8 py-3 text-xs font-black uppercase tracking-widest text-white shadow-[0_10px_25px_rgba(3,199,254,0.3)] transition hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100">
                {savingProfile ? "Saving..." : "Save Profile Changes"}
              </button>
            </div>
          </form>
        </Panel>

        {/* Side Column */}
        <div className="col-span-1 flex flex-col gap-6">
          
          <Panel className="p-6">
            <h2 className="mb-6 flex items-center gap-2 border-b border-[#e0f4fb] pb-4 text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
              <KeyRound size={14} /> Security
            </h2>
            <form onSubmit={handlePasswordChange} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#888]">Reset Email</span>
                <strong className="text-sm font-black text-[#111]">{profile?.email || authUser.email || "Not available"}</strong>
              </div>
              <p className="text-xs font-bold text-[#aaa] leading-relaxed">
                Password changes are sent as a secure reset link to your admin email address.
              </p>
              <button type="submit" disabled={savingPassword} className="mt-2 rounded-2xl border border-[#cfeef7] bg-[#fbfdff] px-5 py-3 text-xs font-black uppercase tracking-widest text-[#111] transition hover:bg-[#f2fbff] disabled:opacity-50">
                {savingPassword ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
          </Panel>

          <Panel className="p-6 bg-[#fbfdff]">
            <h2 className="mb-6 flex items-center gap-2 border-b border-[#e0f4fb] pb-4 text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
              <HeartPulse size={14} /> System Access
            </h2>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#888]">Role Clearance</span>
                <strong className="text-sm font-black text-[#03c7fe]">{roleLabel}</strong>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#888]">Profile Status</span>
                <strong className={`text-sm font-black ${profile?.isBlocked ? "text-red-500" : "text-emerald-500"}`}>
                  {profile?.isBlocked ? "Blocked" : "Active & Verified"}
                </strong>
              </div>
            </div>
          </Panel>

        </div>
      </div>
    </main>
  );
}
