"use client";

import { useEffect, useState } from "react";
import { Search, Plus, Edit2, Trash2, X, CheckCircle2, AlertCircle, Info, Users } from "lucide-react";

/* ─── Shared UI Component ────────────────────────────────────────── */
function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[28px] border border-white bg-white/80 backdrop-blur-xl shadow-[0_20px_50px_rgba(3,199,254,0.08)] ${className}`}>
      {children}
    </div>
  );
}

const inputClass = "w-full rounded-2xl border border-[#cfeef7] bg-white px-4 py-3 text-sm font-bold text-[#111] outline-none transition-colors focus:border-[#03c7fe] focus:ring-2 focus:ring-[#03c7fe]/20 disabled:opacity-60 disabled:bg-gray-50";

type UserRole = "customer" | "admin" | "superadmin";
type UserGender = "Male" | "Female" | "Other";
type UserGoal = "Weight Loss" | "Muscle Gain" | "Maintenance" | "Body Transformation";
type UserActivity = "Sedentary" | "Light" | "Moderate" | "Active" | "Very Active";
type UserDiet = "Standard" | "Vegetarian" | "Vegan" | "Keto" | "Paleo";

type UserSubscription = {
  subscriptionId: string | null;
  active: boolean;
  nextBillingDate: string | null;
  status: "active" | "cancelled" | "completed" | null;
  lastPaymentDate: string | null;
};

type User = {
  _id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  isBlocked: boolean;
  subscription: UserSubscription;
  createdAt: string;
};

type DetailedUserResponse = Omit<UserFormData, "gender" | "goal" | "activity" | "diet"> & {
  gender?: UserGender | null;
  goal?: UserGoal | null;
  activity?: UserActivity | null;
  diet?: UserDiet | null;
};

type UserFormData = {
  fullName: string;
  email: string;
  phone: string;
  age: string;
  gender: "" | UserGender;
  height: string;
  weight: string;
  bmi: string;
  goal: "" | UserGoal;
  activity: "" | UserActivity;
  conditions: string;
  diet: "" | UserDiet;
  sleepHours: string;
  waterIntake: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  country: string;
};

type Toast = {
  message: string;
  type: "success" | "error" | "info";
  id: number;
};

type ConfirmDialog = {
  title: string;
  message: string;
  confirmText: string;
  isDanger: boolean;
  action: () => Promise<void>;
} | null;

const GENDER_OPTIONS: UserGender[] = ["Male", "Female", "Other"];
const GOAL_OPTIONS: UserGoal[] = [
  "Weight Loss",
  "Muscle Gain",
  "Maintenance",
  "Body Transformation",
];
const ACTIVITY_OPTIONS: UserActivity[] = [
  "Sedentary",
  "Light",
  "Moderate",
  "Active",
  "Very Active",
];
const DIET_OPTIONS: UserDiet[] = ["Standard", "Vegetarian", "Vegan", "Keto", "Paleo"];

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoadingId, setStatusLoadingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [formData, setFormData] = useState<UserFormData>({
    fullName: "",
    email: "",
    phone: "",
    age: "",
    gender: "",
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
    country: "",
  });

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>(null);
  const [isConfirmLoading, setIsConfirmLoading] = useState(false);

  /* ---------------- TOAST HELPER ---------------- */
  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { message, type, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  /* ---------------- TOKEN HELPER ---------------- */
  const getToken = () =>
    document.cookie
      .split("; ")
      .find((row) => row.startsWith("firebaseToken="))
      ?.split("=")[1];

  /* ---------------- FETCH USERS ---------------- */
  const fetchUsers = async () => {
    try {
      const token = getToken();
      const res = await fetch("/api/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error("Failed to fetch users");
      }
      const data = await res.json();
      setUsers(data.users || []);

      const decoded = data.users?.find((u: User) => u._id === data.currentUserId);
      if (decoded) setCurrentUser(decoded);
    } catch {
      console.error("Failed to fetch users");
      showToast("Failed to load users.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- SEARCH ---------------- */
  const rolePriority: Record<User["role"], number> = {
    superadmin: 0,
    admin: 1,
    customer: 2,
  };

  const getRolePriority = (role: string | undefined) => rolePriority[role as User["role"]] ?? 99;

  const filteredUsers = users
    .filter(
      (user) =>
        user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const roleDiff = getRolePriority(a.role) - getRolePriority(b.role);
      if (roleDiff !== 0) return roleDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  /* ---------------- EDIT ---------------- */
  const canManageUser = (user: User) =>
    currentUser?.role === "superadmin" &&
    user.role !== "superadmin" &&
    user._id !== currentUser._id;

  const handleEditClick = async (user: User) => {
    if (!canManageUser(user)) return;
    const toInput = (value: unknown) => (value === null || value === undefined ? "" : String(value));
    const toEnumInput = <T extends string>(value: unknown, allowed: readonly T[]): T | "" =>
      typeof value === "string" && allowed.includes(value as T) ? (value as T) : "";

    try {
      setIsEditLoading(true);
      const token = getToken();
      const res = await fetch(`/api/users/${user._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load user details");
      }

      const detailedUser = data.user as Partial<DetailedUserResponse>;
      setEditingUser(user);
      setFormData({
        fullName: toInput(detailedUser.fullName),
        email: toInput(detailedUser.email),
        phone: toInput(detailedUser.phone),
        age: toInput(detailedUser.age),
        gender: toEnumInput(detailedUser.gender, GENDER_OPTIONS),
        height: toInput(detailedUser.height),
        weight: toInput(detailedUser.weight),
        bmi: toInput(detailedUser.bmi),
        goal: toEnumInput(detailedUser.goal, GOAL_OPTIONS),
        activity: toEnumInput(detailedUser.activity, ACTIVITY_OPTIONS),
        conditions: toInput(detailedUser.conditions),
        diet: toEnumInput(detailedUser.diet, DIET_OPTIONS),
        sleepHours: toInput(detailedUser.sleepHours),
        waterIntake: toInput(detailedUser.waterIntake),
        addressLine1: toInput(detailedUser.addressLine1),
        addressLine2: toInput(detailedUser.addressLine2),
        city: toInput(detailedUser.city),
        postalCode: toInput(detailedUser.postalCode),
        country: toInput(detailedUser.country),
      });
      setIsModalOpen(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load user details";
      showToast(message, "error");
    } finally {
      setIsEditLoading(false);
    }
  };

  const toggleUserStatus = (user: User) => {
    if (!canManageUser(user)) return;

    const nextBlockedState = !user.isBlocked;
    const actionText = nextBlockedState ? "disable" : "enable";

    setConfirmDialog({
      title: `${nextBlockedState ? "Disable" : "Enable"} User`,
      message: `Are you sure you want to ${actionText} ${user.fullName}?`,
      confirmText: nextBlockedState ? "Disable" : "Enable",
      isDanger: nextBlockedState,
      action: async () => {
        try {
          setStatusLoadingId(user._id);
          const token = getToken();
          const res = await fetch(`/api/users/${user._id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ isBlocked: nextBlockedState }),
          });

          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || "Failed to update user status");
          }

          setUsers((prev) =>
            prev.map((existingUser) =>
              existingUser._id === user._id
                ? { ...existingUser, isBlocked: nextBlockedState }
                : existingUser
            )
          );
          showToast(`User ${actionText}d successfully.`, "success");
          if (data.warning) {
            showToast(data.warning, "info");
          }
        } finally {
          setStatusLoadingId(null);
        }
      },
    });
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    try {
      setIsEditLoading(true);
      const token = getToken();
      const res = await fetch(`/api/users/${editingUser._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update user");

      setIsModalOpen(false);
      setEditingUser(null);
      fetchUsers();
      showToast("User details updated.", "success");
    } catch (error) {
      console.error(error);
      showToast("Error saving user. Please try again.", "error");
    } finally {
      setIsEditLoading(false);
    }
  };

  /* ---------------- DELETE ---------------- */
  const deleteUser = (user: User) => {
    if (currentUser?.role !== "superadmin") return;

    setConfirmDialog({
      title: "Delete User",
      message: `Are you sure you want to permanently delete ${user.fullName}? This action cannot be undone.`,
      confirmText: "Delete",
      isDanger: true,
      action: async () => {
        const token = getToken();
        const res = await fetch(`/api/users/${user._id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Failed to delete user");
        fetchUsers();
        showToast("User deleted permanently.", "success");
      },
    });
  };

  const executeConfirmAction = async () => {
    if (!confirmDialog) return;
    setIsConfirmLoading(true);
    try {
      await confirmDialog.action();
      setConfirmDialog(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Operation failed. Please try again.";
      showToast(message, "error");
    } finally {
      setIsConfirmLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f2fbff]">
        <div className="flex flex-col items-center gap-4">
          <Users size={32} className="animate-pulse text-[#03c7fe]" />
          <h2 className="text-xs font-black uppercase tracking-widest text-[#888]">Loading Users...</h2>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f2fbff] px-4 py-8 md:px-8">
      {/* Toast Container */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 rounded-2xl px-5 py-3 text-xs font-black text-white shadow-[0_10px_25px_rgba(0,0,0,0.1)] transition-all animate-in slide-in-from-right-8 ${
              toast.type === "success"
                ? "bg-emerald-500"
                : toast.type === "error"
                ? "bg-red-500"
                : "bg-[#111]"
            }`}
          >
            {toast.type === "success" && <CheckCircle2 size={16} />}
            {toast.type === "error" && <AlertCircle size={16} />}
            {toast.type === "info" && <Info size={16} />}
            {toast.message}
          </div>
        ))}
      </div>

      {/* Page Header Panel */}
      <Panel className="mb-6 flex flex-col gap-6 p-7 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#03c7fe] text-white shadow-[0_8px_20px_rgba(3,199,254,0.3)]">
            <Users size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">User Management</p>
            <h1 className="text-2xl font-black text-[#111]">Customers & Admins</h1>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aaa]" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-[#cfeef7] bg-white py-3 pl-10 pr-4 text-xs font-bold text-[#111] outline-none transition focus:border-[#03c7fe] focus:ring-2 focus:ring-[#03c7fe]/20"
            />
          </div>
          <button
            onClick={() => showToast("Users must register through the public site.", "info")}
            className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-[#03c7fe] px-5 py-3 text-xs font-black text-white shadow-[0_10px_25px_rgba(3,199,254,0.3)] transition hover:scale-[1.02]"
          >
            <Plus size={14} /> Add User
          </button>
        </div>
      </Panel>

      {/* Data Table Panel */}
      <Panel className="p-6">
        <div className="mb-4 flex items-center justify-between border-b border-[#e0f4fb] pb-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#aaa]">
            {filteredUsers.length} total users
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">User</th>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Role</th>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Subscription</th>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Status</th>
                <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-sm font-bold text-[#aaa]">
                    No users found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user._id} className="border-t border-[#e0f4fb] transition hover:bg-[#f2fbff]">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#03c7fe] text-xs font-black text-white shadow-[0_4px_10px_rgba(3,199,254,0.3)]">
                          {user.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-[#111]">{user.fullName}</span>
                          <span className="text-[10px] font-bold text-[#aaa]">{user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="inline-flex items-center rounded-full bg-[#fbfdff] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#111] ring-1 ring-inset ring-[#cfeef7]">
                        {user.role}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {user.subscription?.active ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-600 ring-1 ring-inset ring-emerald-500/20">
                          {user.subscription.status === "active" ? "Active" : "Subscribed"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#aaa] ring-1 ring-inset ring-gray-200">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {user.isBlocked ? (
                        <span className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-red-500 ring-1 ring-inset ring-red-500/20">
                          Blocked
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-600 ring-1 ring-inset ring-emerald-500/20">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {canManageUser(user) ? (
                          <>
                            <button
                              type="button"
                              onClick={() => toggleUserStatus(user)}
                              disabled={statusLoadingId === user._id}
                              className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                user.isBlocked
                                  ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                                  : "bg-amber-50 text-amber-600 hover:bg-amber-100"
                              }`}
                            >
                              {statusLoadingId === user._id ? "..." : user.isBlocked ? "Enable" : "Disable"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditClick(user)}
                              disabled={isEditLoading}
                              className="p-2 text-[#aaa] transition hover:text-[#03c7fe]"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteUser(user)}
                              className="p-2 text-[#aaa] transition hover:text-red-500"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] font-black text-[#aaa]">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Confirmation Modal Overlay */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#111]/20 p-4 backdrop-blur-sm">
          <Panel className="flex w-full max-w-sm flex-col overflow-hidden p-0">
            <div className="p-6">
              <h3 className="text-lg font-black text-[#111]">{confirmDialog.title}</h3>
              <p className="mt-2 text-xs font-bold text-[#888]">{confirmDialog.message}</p>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-[#cfeef7] bg-[#fbfdff] px-6 py-5">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                disabled={isConfirmLoading}
                className="rounded-2xl border border-[#cfeef7] bg-white px-5 py-3 text-xs font-black text-[#111] transition hover:bg-[#f2fbff] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeConfirmAction}
                disabled={isConfirmLoading}
                className={`rounded-2xl px-5 py-3 text-xs font-black text-white shadow-sm transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 ${
                  confirmDialog.isDanger ? "bg-red-500 shadow-[0_10px_25px_rgba(239,68,68,0.3)]" : "bg-[#03c7fe] shadow-[0_10px_25px_rgba(3,199,254,0.3)]"
                }`}
              >
                {isConfirmLoading ? "Processing..." : confirmDialog.confirmText}
              </button>
            </div>
          </Panel>
        </div>
      )}

      {/* Edit User Modal Overlay */}
      {isModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111]/20 p-4 backdrop-blur-sm sm:p-6">
          <Panel className="flex w-full max-w-3xl max-h-[90vh] flex-col overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-[#cfeef7] bg-[#fbfdff] px-6 py-5">
              <h3 className="text-lg font-black text-[#111]">Edit User</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-2 text-[#aaa] transition-colors hover:bg-[#f2fbff] hover:text-[#111]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto p-6 bg-white">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Full Name</label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    disabled
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Age</label>
                  <input
                    type="number"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) =>
                      setFormData({ ...formData, gender: e.target.value as UserFormData["gender"] })
                    }
                    className={inputClass}
                  >
                    <option value="">Select gender</option>
                    {GENDER_OPTIONS.map((gender) => (
                      <option key={gender} value={gender}>{gender}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Height (cm)</label>
                  <input
                    type="number"
                    value={formData.height}
                    onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Weight (kg)</label>
                  <input
                    type="number"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">BMI</label>
                  <input
                    type="number"
                    value={formData.bmi}
                    onChange={(e) => setFormData({ ...formData, bmi: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Goal</label>
                  <select
                    value={formData.goal}
                    onChange={(e) =>
                      setFormData({ ...formData, goal: e.target.value as UserFormData["goal"] })
                    }
                    className={inputClass}
                  >
                    <option value="">Select your goal</option>
                    {GOAL_OPTIONS.map((goal) => (
                      <option key={goal} value={goal}>{goal}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Activity</label>
                  <select
                    value={formData.activity}
                    onChange={(e) =>
                      setFormData({ ...formData, activity: e.target.value as UserFormData["activity"] })
                    }
                    className={inputClass}
                  >
                    <option value="">Select activity</option>
                    {ACTIVITY_OPTIONS.map((activity) => (
                      <option key={activity} value={activity}>{activity}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Diet</label>
                  <select
                    value={formData.diet}
                    onChange={(e) =>
                      setFormData({ ...formData, diet: e.target.value as UserFormData["diet"] })
                    }
                    className={inputClass}
                  >
                    <option value="">Select diet</option>
                    {DIET_OPTIONS.map((diet) => (
                      <option key={diet} value={diet}>{diet}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Conditions</label>
                  <input
                    type="text"
                    value={formData.conditions}
                    onChange={(e) => setFormData({ ...formData, conditions: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Sleep Hours</label>
                  <input
                    type="number"
                    value={formData.sleepHours}
                    onChange={(e) => setFormData({ ...formData, sleepHours: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Water Intake (L)</label>
                  <input
                    type="number"
                    value={formData.waterIntake}
                    onChange={(e) => setFormData({ ...formData, waterIntake: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Address Line 1</label>
                  <input
                    type="text"
                    value={formData.addressLine1}
                    onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Address Line 2</label>
                  <input
                    type="text"
                    value={formData.addressLine2}
                    onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Postal Code</label>
                  <input
                    type="text"
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Country</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[#cfeef7] bg-[#fbfdff] px-6 py-5">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-2xl border border-[#cfeef7] bg-white px-5 py-3 text-xs font-black text-[#111] transition hover:bg-[#f2fbff]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveUser}
                disabled={isEditLoading}
                className="rounded-2xl bg-[#03c7fe] px-5 py-3 text-xs font-black text-white shadow-[0_10px_25px_rgba(3,199,254,0.3)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isEditLoading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </Panel>
        </div>
      )}
    </main>
  );
}
