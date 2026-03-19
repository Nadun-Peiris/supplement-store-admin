"use client";

import { useEffect, useState } from "react";
import { Search, Plus, Edit2, Trash2, X, CheckCircle2, AlertCircle, Info } from "lucide-react";

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

  // Custom UI States for Alerts/Confirms
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
      <div className="flex h-[50vh] items-center justify-center">
        <h2 className="text-lg font-semibold text-gray-500">Loading users...</h2>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 relative">
      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg transition-all animate-in slide-in-from-right-8 ${
              toast.type === "success"
                ? "bg-green-600"
                : toast.type === "error"
                ? "bg-red-600"
                : "bg-[#01C7FE]"
            }`}
          >
            {toast.type === "success" && <CheckCircle2 size={18} />}
            {toast.type === "error" && <AlertCircle size={18} />}
            {toast.type === "info" && <Info size={18} />}
            {toast.message}
          </div>
        ))}
      </div>

      {/* Page Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-gray-900">Users Management</h1>
            <p className="text-sm text-gray-500 sm:hidden">Manage your customers and admins.</p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 outline-none transition-colors focus:border-[#01C7FE] focus:ring-1 focus:ring-[#01C7FE]"
            />
          </div>
        </div>
        <button
          onClick={() => showToast("Users must register through the public site.", "info")}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#01C7FE] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#00b3e6]"
        >
          <Plus size={18} />
          Add User
        </button>
      </header>

      {/* Data Table */}
      <main className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">User</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Role</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Subscription</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-gray-500">
                    No users found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user._id} className="transition-colors hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#01C7FE]/10 text-sm font-bold text-[#01C7FE] ring-1 ring-inset ring-[#01C7FE]/20">
                          {user.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-gray-900">{user.fullName}</span>
                          <span className="text-xs text-gray-500">{user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 capitalize">
                      {user.role}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {user.subscription?.active ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                          {user.subscription.status === "active" ? "Active" : "Subscribed"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/20">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {user.isBlocked ? (
                        <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                          Blocked
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-3">
                        {canManageUser(user) ? (
                          <>
                            <button
                              type="button"
                              onClick={() => toggleUserStatus(user)}
                              disabled={statusLoadingId === user._id}
                              className={`rounded-md px-2 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                user.isBlocked
                                  ? "bg-green-50 text-green-700 hover:bg-green-100"
                                  : "bg-red-50 text-red-700 hover:bg-red-100"
                              }`}
                            >
                              {statusLoadingId === user._id ? "Updating..." : user.isBlocked ? "Enable" : "Disable"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditClick(user)}
                              disabled={isEditLoading}
                              className="text-gray-400 transition-colors hover:text-[#01C7FE]"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteUser(user)}
                              className="text-gray-400 transition-colors hover:text-red-600"
                            >
                              <Trash2 size={18} />
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Confirmation Modal Overlay */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-sm sm:p-6">
          <div className="flex w-full max-w-sm flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900">{confirmDialog.title}</h3>
              <p className="mt-2 text-sm text-gray-500">{confirmDialog.message}</p>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                disabled={isConfirmLoading}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeConfirmAction}
                disabled={isConfirmLoading}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  confirmDialog.isDanger ? "bg-red-600 hover:bg-red-700" : "bg-[#01C7FE] hover:bg-[#00b3e6]"
                }`}
              >
                {isConfirmLoading ? "Processing..." : confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal Overlay */}
      {isModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-sm sm:p-6">
          <div className="flex w-full max-w-3xl max-h-[90vh] flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900">Edit User</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto p-6">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Full Name</label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-[#01C7FE] focus:bg-white focus:ring-1 focus:ring-[#01C7FE]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    disabled
                    className="w-full cursor-not-allowed rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-500 outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-[#01C7FE] focus:bg-white focus:ring-1 focus:ring-[#01C7FE]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Age</label>
                  <input
                    type="number"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-[#01C7FE] focus:bg-white focus:ring-1 focus:ring-[#01C7FE]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) =>
                      setFormData({ ...formData, gender: e.target.value as UserFormData["gender"] })
                    }
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-[#01C7FE] focus:bg-white focus:ring-1 focus:ring-[#01C7FE]"
                  >
                    <option value="">Select gender</option>
                    {GENDER_OPTIONS.map((gender) => (
                      <option key={gender} value={gender}>
                        {gender}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Height</label>
                  <input
                    type="number"
                    value={formData.height}
                    onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-[#01C7FE] focus:bg-white focus:ring-1 focus:ring-[#01C7FE]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Weight</label>
                  <input
                    type="number"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-[#01C7FE] focus:bg-white focus:ring-1 focus:ring-[#01C7FE]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">BMI</label>
                  <input
                    type="number"
                    value={formData.bmi}
                    onChange={(e) => setFormData({ ...formData, bmi: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-[#01C7FE] focus:bg-white focus:ring-1 focus:ring-[#01C7FE]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Goal</label>
                  <select
                    value={formData.goal}
                    onChange={(e) =>
                      setFormData({ ...formData, goal: e.target.value as UserFormData["goal"] })
                    }
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-[#01C7FE] focus:bg-white focus:ring-1 focus:ring-[#01C7FE]"
                  >
                    <option value="">Select your goal</option>
                    {GOAL_OPTIONS.map((goal) => (
                      <option key={goal} value={goal}>
                        {goal}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Activity</label>
                  <select
                    value={formData.activity}
                    onChange={(e) =>
                      setFormData({ ...formData, activity: e.target.value as UserFormData["activity"] })
                    }
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-[#01C7FE] focus:bg-white focus:ring-1 focus:ring-[#01C7FE]"
                  >
                    <option value="">Select activity</option>
                    {ACTIVITY_OPTIONS.map((activity) => (
                      <option key={activity} value={activity}>
                        {activity}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Diet</label>
                  <select
                    value={formData.diet}
                    onChange={(e) =>
                      setFormData({ ...formData, diet: e.target.value as UserFormData["diet"] })
                    }
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-[#01C7FE] focus:bg-white focus:ring-1 focus:ring-[#01C7FE]"
                  >
                    <option value="">Select diet</option>
                    {DIET_OPTIONS.map((diet) => (
                      <option key={diet} value={diet}>
                        {diet}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Conditions</label>
                  <input
                    type="text"
                    value={formData.conditions}
                    onChange={(e) => setFormData({ ...formData, conditions: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-[#01C7FE] focus:bg-white focus:ring-1 focus:ring-[#01C7FE]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Sleep Hours</label>
                  <input
                    type="number"
                    value={formData.sleepHours}
                    onChange={(e) => setFormData({ ...formData, sleepHours: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-[#01C7FE] focus:bg-white focus:ring-1 focus:ring-[#01C7FE]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Water Intake</label>
                  <input
                    type="number"
                    value={formData.waterIntake}
                    onChange={(e) => setFormData({ ...formData, waterIntake: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-[#01C7FE] focus:bg-white focus:ring-1 focus:ring-[#01C7FE]"
                  />
                </div>
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-sm font-medium text-gray-700">Address Line 1</label>
                  <input
                    type="text"
                    value={formData.addressLine1}
                    onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-[#01C7FE] focus:bg-white focus:ring-1 focus:ring-[#01C7FE]"
                  />
                </div>
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-sm font-medium text-gray-700">Address Line 2</label>
                  <input
                    type="text"
                    value={formData.addressLine2}
                    onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-[#01C7FE] focus:bg-white focus:ring-1 focus:ring-[#01C7FE]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-[#01C7FE] focus:bg-white focus:ring-1 focus:ring-[#01C7FE]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Postal Code</label>
                  <input
                    type="text"
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-[#01C7FE] focus:bg-white focus:ring-1 focus:ring-[#01C7FE]"
                  />
                </div>
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-sm font-medium text-gray-700">Country</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-[#01C7FE] focus:bg-white focus:ring-1 focus:ring-[#01C7FE]"
                  />
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveUser}
                disabled={isEditLoading}
                className="rounded-lg bg-[#01C7FE] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#00b3e6]"
              >
                {isEditLoading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
