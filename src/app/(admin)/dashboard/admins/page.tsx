"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { adminFetch } from "@/lib/adminClient";
import { Search, Plus, Trash2, X, UserCog, ShieldCheck } from "lucide-react";
import ConfirmDialog from "@/app/(admin)/dashboard/components/ConfirmDialog";
import PageLoader from "@/app/(admin)/dashboard/components/PageLoader";

type AdminUser = {
  _id: string;
  email: string;
  role: "admin" | "superadmin";
};

type ConfirmState = {
  title: string;
  message: string;
  confirmText: string;
  isDanger?: boolean;
  onConfirm: () => Promise<void>;
};

/* ─── Shared UI Component ────────────────────────────────────────── */
function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[28px] border border-white bg-white/80 backdrop-blur-xl shadow-[0_20px_50px_rgba(3,199,254,0.08)] ${className}`}>
      {children}
    </div>
  );
}

export default function ManageAdminsPage() {
  const [email, setEmail] = useState("");
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "superadmin">("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [isConfirmLoading, setIsConfirmLoading] = useState(false);

  // 🔹 Fetch admins from MongoDB
  const fetchAdmins = useCallback(async () => {
    try {
      const res = await adminFetch("/api/admin/set-role", { method: "GET" });

      const data = await res.json();

      if (!res.ok) {
        setMessage(`⚠️ ${data.error || "Failed to fetch admins."}`);
        return;
      }

      setAdmins(data.admins || []);
    } catch (error) {
      console.error("Error fetching admins:", error);
      setMessage("⚠️ Failed to fetch admins.");
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  // 🔹 Filter Admins
  const filteredAdmins = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = admins.filter((admin) => {
      const matchesRole = roleFilter === "all" ? true : admin.role === roleFilter;
      const matchesQuery = query ? admin.email.toLowerCase().includes(query) : true;
      return matchesRole && matchesQuery;
    });

    if (roleFilter !== "all") {
      return filtered;
    }

    return filtered.sort((left, right) => {
      if (left.role === right.role) {
        return 0;
      }

      return left.role === "superadmin" ? -1 : 1;
    });
  }, [admins, roleFilter, searchQuery]);

  const adminSummary = useMemo(() => {
    const total = admins.length;
    const adminCount = admins.filter((admin) => admin.role === "admin").length;
    const superadminCount = admins.filter((admin) => admin.role === "superadmin").length;

    return {
      total,
      adminCount,
      superadminCount,
    };
  }, [admins]);

  // 🔹 Update Firebase role via API route
  const updateRole = async (targetEmail: string, makeAdmin: boolean) => {
    if (!targetEmail.trim()) return setMessage("Please enter an email address.");

    setLoading(true);
    setMessage("");

    try {
      const res = await adminFetch("/api/admin/set-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: targetEmail, makeAdmin }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(makeAdmin ? "✅ User promoted to Admin!" : "❎ Admin role removed.");
        if (makeAdmin) {
          setEmail("");
          setIsModalOpen(false);
        }
        await fetchAdmins(); // 🔄 Auto refresh admin list
      } else {
        setMessage(`⚠️ ${data.error || "Failed to update role."}`);
      }
    } catch {
      setMessage("⚠️ Failed to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  const requestRevokeAdmin = (targetEmail: string) => {
    setConfirmState({
      title: "Revoke admin access",
      message: `Are you sure you want to revoke admin access for ${targetEmail}?`,
      confirmText: "Revoke Access",
      isDanger: true,
      onConfirm: async () => {
        await updateRole(targetEmail, false);
        setConfirmState(null);
      },
    });
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEmail("");
    setMessage("");
  };

  if (pageLoading) {
    return <PageLoader icon={UserCog} label="Loading Admins..." />;
  }

  return (
    <main className="min-h-screen bg-[#f2fbff] px-4 py-8 md:px-8">
      {/* Global Status Message */}
      {message && !isModalOpen && (
        <div className="mb-6 rounded-2xl border border-[#cfeef7] bg-[#e0f4fb] px-5 py-3 text-xs font-black text-[#03c7fe] shadow-sm">
          {message}
        </div>
      )}

      {/* Page Header Panel */}
      <Panel className="mb-6 flex flex-col gap-6 p-7 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#03c7fe] text-white shadow-[0_8px_20px_rgba(3,199,254,0.3)]">
            <UserCog size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">System Access</p>
            <h1 className="text-2xl font-black text-[#111]">Manage Admins</h1>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aaa]" />
            <input
              type="text"
              placeholder="Search by email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-[#cfeef7] bg-white py-3 pl-10 pr-4 text-xs font-bold text-[#111] outline-none transition focus:border-[#03c7fe] focus:ring-2 focus:ring-[#03c7fe]/20"
            />
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-[#03c7fe] px-5 py-3 text-xs font-black text-white shadow-[0_10px_25px_rgba(3,199,254,0.3)] transition hover:scale-[1.02]"
          >
            <Plus size={14} /> Add Admin
          </button>
        </div>
      </Panel>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-[24px] border border-white bg-white/80 p-5 backdrop-blur-xl shadow-[0_20px_50px_rgba(3,199,254,0.08)]">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">All Admins</p>
          <p className="mt-2 text-2xl font-black text-[#111]">{adminSummary.total}</p>
        </div>
        <div className="rounded-[24px] border border-white bg-white/80 p-5 backdrop-blur-xl shadow-[0_20px_50px_rgba(3,199,254,0.08)]">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Admins</p>
          <p className="mt-2 text-2xl font-black text-[#111]">{adminSummary.adminCount}</p>
        </div>
        <div className="rounded-[24px] border border-white bg-white/80 p-5 backdrop-blur-xl shadow-[0_20px_50px_rgba(3,199,254,0.08)]">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Superadmins</p>
          <p className="mt-2 text-2xl font-black text-[#111]">{adminSummary.superadminCount}</p>
        </div>
      </div>

      {/* Data Table Panel */}
      <Panel className="p-6">
        <div className="mb-6 flex flex-col gap-5 border-b border-[#e0f4fb] pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-fit gap-1.5 rounded-2xl border border-[#cfeef7] bg-[#fbfdff] p-1.5">
            {[
              { value: "all" as const, label: "All Admins" },
              { value: "admin" as const, label: "Admins" },
              { value: "superadmin" as const, label: "Superadmins" },
            ].map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setRoleFilter(filter.value)}
                className={`rounded-xl px-4 py-2 text-xs font-black transition-colors ${
                  roleFilter === filter.value
                    ? "bg-[#03c7fe] text-white shadow-sm"
                    : "text-[#888] hover:bg-[#e0f4fb]"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <p className="text-[10px] font-black uppercase tracking-widest text-[#aaa]">
            {filteredAdmins.length} total administrators
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse">
            <thead>
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
                  User Email
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
                  Current Role
                </th>
                <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAdmins.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-sm font-bold text-[#aaa]">
                    No administrators found.
                  </td>
                </tr>
              ) : (
                filteredAdmins.map((admin) => (
                  <tr key={admin._id} className="border-t border-[#e0f4fb] transition hover:bg-[#f2fbff]">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-black text-[#111]">
                      {admin.email}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f2fbff] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#03c7fe]">
                        <ShieldCheck size={12} /> {admin.role}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      {admin.role === "superadmin" ? (
                        <span className="text-[10px] font-black text-[#aaa]">—</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => requestRevokeAdmin(admin.email)}
                          disabled={loading}
                          className="inline-flex items-center justify-center rounded-xl p-2 text-[#aaa] transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                          title="Revoke Admin Access"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* "Add Admin" Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#111]/20 p-4 backdrop-blur-sm">
          <Panel className="flex w-full max-w-md flex-col overflow-hidden p-0">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#cfeef7] bg-[#fbfdff] px-6 py-5">
              <h3 className="text-lg font-black text-[#111]">Promote User to Admin</h3>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full p-2 text-[#aaa] transition-colors hover:bg-[#f2fbff] hover:text-[#111]"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateRole(email, true);
              }}
              className="flex flex-col bg-white"
            >
              <div className="flex flex-col gap-5 p-6">
                {message && (
                  <div className="rounded-2xl border border-[#cfeef7] bg-[#e0f4fb] px-4 py-3 text-xs font-black text-[#03c7fe]">
                    {message}
                  </div>
                )}
                
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    required
                    className="w-full rounded-2xl border border-[#cfeef7] bg-white px-4 py-3 text-sm font-bold text-[#111] outline-none transition-colors focus:border-[#03c7fe] focus:ring-2 focus:ring-[#03c7fe]/20"
                  />
                  <p className="mt-1 text-[10px] font-bold text-[#aaa]">
                    The user must already have a registered account.
                  </p>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[#cfeef7] bg-[#fbfdff] px-6 py-5">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-2xl border border-[#cfeef7] bg-white px-5 py-3 text-xs font-black text-[#111] transition hover:bg-[#f2fbff]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-2xl bg-[#03c7fe] px-5 py-3 text-xs font-black text-white shadow-[0_10px_25px_rgba(3,199,254,0.3)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Processing..." : "Promote to Admin"}
                </button>
              </div>
            </form>
          </Panel>
        </div>
      )}

      {confirmState && (
        <ConfirmDialog
          title={confirmState.title}
          message={confirmState.message}
          confirmText={confirmState.confirmText}
          isDanger={confirmState.isDanger}
          isLoading={isConfirmLoading}
          onCancel={() => {
            if (!isConfirmLoading) {
              setConfirmState(null);
            }
          }}
          onConfirm={async () => {
            setIsConfirmLoading(true);
            try {
              await confirmState.onConfirm();
            } finally {
              setIsConfirmLoading(false);
            }
          }}
        />
      )}
    </main>
  );
}
