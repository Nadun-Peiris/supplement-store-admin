"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, Plus, Trash2, X } from "lucide-react";

type AdminUser = {
  _id: string;
  email: string;
  role: "admin" | "superadmin";
};

export default function ManageAdminsPage() {
  const [email, setEmail] = useState("");
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const getToken = () =>
    document.cookie
      .split("; ")
      .find((row) => row.startsWith("firebaseToken="))
      ?.split("=")[1];

  // 🔹 Fetch admins from MongoDB
  const fetchAdmins = useCallback(async () => {
    try {
      const token = getToken();
      if (!token) {
        setMessage("⚠️ Unauthorized. Please log in again.");
        return;
      }

      const res = await fetch("/api/admin/set-role", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(`⚠️ ${data.error || "Failed to fetch admins."}`);
        return;
      }

      setAdmins(data.admins || []);
    } catch (error) {
      console.error("Error fetching admins:", error);
      setMessage("⚠️ Failed to fetch admins.");
    }
  }, []);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  // 🔹 Filter Admins
  const filteredAdmins = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return admins;
    return admins.filter((admin) =>
      admin.email.toLowerCase().includes(query)
    );
  }, [admins, searchQuery]);

  // 🔹 Update Firebase role via API route
  const updateRole = async (targetEmail: string, makeAdmin: boolean) => {
    if (!targetEmail.trim()) return setMessage("Please enter an email address.");
    
    // Add a confirmation dialog before revoking access
    if (!makeAdmin) {
      const confirmed = confirm(`Are you sure you want to revoke admin access for ${targetEmail}?`);
      if (!confirmed) return;
    }

    setLoading(true);
    setMessage("");

    try {
      const token = getToken();
      if (!token) {
        setMessage("⚠️ Unauthorized. Please log in again.");
        return;
      }

      const res = await fetch("/api/admin/set-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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

  const closeModal = () => {
    setIsModalOpen(false);
    setEmail("");
    setMessage("");
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-gray-900">Manage Admins</h1>
            <p className="text-sm text-gray-500 sm:hidden">Control access levels and privileges.</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search by email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 outline-none transition-colors focus:border-[#01C7FE] focus:ring-1 focus:ring-[#01C7FE]"
            />
          </div>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#01C7FE] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#00b3e6]"
        >
          <Plus size={18} />
          Add Admin
        </button>
      </header>

      {/* Status Message Display */}
      {message && !isModalOpen && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-700">{message}</p>
        </div>
      )}

      {/* Data Table */}
      <main className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  User Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Current Role
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredAdmins.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-sm text-gray-500">
                    No administrators found.
                  </td>
                </tr>
              ) : (
                filteredAdmins.map((admin) => (
                  <tr key={admin._id} className="transition-colors hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {admin.email}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium capitalize text-[#01C7FE] ring-1 ring-inset ring-[#01C7FE]/20">
                        {admin.role}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                      <button
                        type="button"
                        onClick={() => updateRole(admin.email, false)}
                        disabled={loading}
                        className="inline-flex items-center gap-1 text-gray-400 transition-colors hover:text-red-600 disabled:opacity-50"
                        title="Revoke Admin Access"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* "Add Admin" Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-sm sm:p-6">
          <div className="flex w-full max-w-md flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900">Promote User to Admin</h3>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
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
              className="flex flex-col"
            >
              <div className="flex flex-col gap-4 p-6">
                {message && (
                  <p className="rounded-md bg-gray-50 p-3 text-sm font-medium text-gray-700">
                    {message}
                  </p>
                )}
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    required
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-[#01C7FE] focus:bg-white focus:ring-1 focus:ring-[#01C7FE]"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    The user must already have an account to be promoted.
                  </p>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-[#01C7FE] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#00b3e6] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Processing..." : "Promote"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}