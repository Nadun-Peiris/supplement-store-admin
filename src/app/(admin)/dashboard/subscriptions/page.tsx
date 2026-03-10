"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Repeat, RefreshCw } from "lucide-react";

interface BillingDetails {
  firstName: string;
  lastName: string;
  email: string;
}

interface OrderRef {
  billingDetails: BillingDetails;
  total: number;
  createdAt: string;
}

interface Subscription {
  _id: string;
  subscriptionId: string;
  status: string;
  nextBillingDate: string;
  totalInstallmentsPaid: number;
  orderId: OrderRef;
}

type StatusTab = "active" | "cancelled" | "all";

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusTab, setStatusTab] = useState<StatusTab>("active");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadSubscriptions = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await fetch("/api/subscriptions");
      const data = await res.json();
      setSubscriptions(data.subscriptions || []);
    } catch (err) {
      console.error("Failed to load subscriptions", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  /* ---------------- SEARCH & FILTER ---------------- */
  const filteredSubscriptions = useMemo(() => {
    let list = subscriptions;

    if (statusTab === "active") {
      list = list.filter((sub) => (sub.status || "").toLowerCase() === "active");
    }

    if (statusTab === "cancelled") {
      list = list.filter((sub) => {
        const normalized = (sub.status || "").toLowerCase();
        return normalized === "cancelled" || normalized === "canceled";
      });
    }

    if (startDate) {
      const start = new Date(`${startDate}T00:00:00`);
      list = list.filter((sub) => {
        if (!sub.nextBillingDate) return false;
        return new Date(sub.nextBillingDate) >= start;
      });
    }

    if (endDate) {
      const end = new Date(`${endDate}T23:59:59.999`);
      list = list.filter((sub) => {
        if (!sub.nextBillingDate) return false;
        return new Date(sub.nextBillingDate) <= end;
      });
    }

    const query = searchQuery.trim().toLowerCase();
    if (!query) return list;
    
    return list.filter((sub) => {
      const customer = sub.orderId?.billingDetails;
      const fullName = `${customer?.firstName || ""} ${customer?.lastName || ""}`.toLowerCase();
      
      return (
        fullName.includes(query) ||
        (customer?.email || "").toLowerCase().includes(query) ||
        sub.subscriptionId.toLowerCase().includes(query)
      );
    });
  }, [subscriptions, searchQuery, statusTab, startDate, endDate]);

  const tabCounts = useMemo(
    () => ({
      active: subscriptions.filter((sub) => (sub.status || "").toLowerCase() === "active").length,
      cancelled: subscriptions.filter((sub) => {
        const normalized = (sub.status || "").toLowerCase();
        return normalized === "cancelled" || normalized === "canceled";
      }).length,
      all: subscriptions.length,
    }),
    [subscriptions]
  );

  const cancelSubscription = async (subscriptionId: string) => {
    setCancellingId(subscriptionId);
    try {
      const res = await fetch(`/api/subscriptions/${subscriptionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `Failed to cancel subscription (${res.status})`);
      }

      setSubscriptions((prev) =>
        prev.map((sub) =>
          sub._id === subscriptionId ? { ...sub, status: "cancelled" } : sub
        )
      );
    } catch (error) {
      console.error(error);
    } finally {
      setCancellingId(null);
    }
  };

  /* ---------------- HELPERS ---------------- */
  const getStatusBadge = (statusStr: string) => {
    const normalized = (statusStr || "").toLowerCase();
    switch (normalized) {
      case "active":
        return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
      case "canceled":
      case "cancelled":
        return "bg-red-50 text-red-700 ring-red-600/20";
      case "past_due":
        return "bg-amber-50 text-amber-700 ring-amber-600/20";
      case "pending":
        return "bg-blue-50 text-blue-700 ring-blue-600/20";
      default:
        return "bg-gray-50 text-gray-600 ring-gray-500/20";
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <h2 className="text-lg font-semibold text-gray-500">Loading subscriptions...</h2>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 min-h-[80vh]">
      {/* Page Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
            <p className="text-sm text-gray-500">Track recurring orders and installment plans.</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={() => loadSubscriptions(true)}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            <div className="flex w-full gap-2 sm:w-auto">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-[#01C7FE] focus:ring-1 focus:ring-[#01C7FE] sm:w-40"
                aria-label="Filter from next billing date"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-[#01C7FE] focus:ring-1 focus:ring-[#01C7FE] sm:w-40"
                aria-label="Filter to next billing date"
              />
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                  }}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="relative w-full sm:w-80">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by customer, email, or Sub ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 outline-none transition-colors focus:border-[#01C7FE] focus:ring-1 focus:ring-[#01C7FE]"
              />
            </div>
          </div>
        </div>
        
        {/* Stats Pill */}
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 shadow-sm">
          <Repeat size={16} className="text-[#01C7FE]" />
          <span className="text-sm font-medium text-gray-500">Total Active:</span>
          <strong className="text-lg font-bold text-[#01C7FE]">
            {subscriptions.filter(s => s.status.toLowerCase() === 'active').length}
          </strong>
        </div>
      </header>

      {/* Status Tabs */}
      <div className="flex w-fit gap-2 rounded-lg border border-gray-200 bg-white p-1">
        <button
          onClick={() => setStatusTab("active")}
          className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${
            statusTab === "active"
              ? "bg-[#01C7FE] text-white"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          <span className="inline-flex items-center gap-2">
            Active
            {tabCounts.active > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
                {tabCounts.active}
              </span>
            )}
          </span>
        </button>
        <button
          onClick={() => setStatusTab("cancelled")}
          className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${
            statusTab === "cancelled"
              ? "bg-[#01C7FE] text-white"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          <span className="inline-flex items-center gap-2">
            Cancelled
            {tabCounts.cancelled > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
                {tabCounts.cancelled}
              </span>
            )}
          </span>
        </button>
        <button
          onClick={() => setStatusTab("all")}
          className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${
            statusTab === "all"
              ? "bg-[#01C7FE] text-white"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          <span className="inline-flex items-center gap-2">
            All
            {tabCounts.all > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
                {tabCounts.all}
              </span>
            )}
          </span>
        </button>
      </div>

      {/* Data Table */}
      <main className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Subscription ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Next Billing
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Payments Made
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredSubscriptions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-gray-500">
                    No subscriptions found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredSubscriptions.map((sub) => {
                  const customer = sub.orderId?.billingDetails;
                  const normalizedStatus = (sub.status || "").toLowerCase();
                  const canCancel =
                    normalizedStatus !== "cancelled" &&
                    normalizedStatus !== "canceled" &&
                    normalizedStatus !== "completed";

                  return (
                    <tr key={sub._id} className="transition-colors hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-[#01C7FE]">
                        {sub.subscriptionId}
                      </td>
                      
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-gray-900">
                            {customer?.firstName || "Unknown"} {customer?.lastName || ""}
                          </span>
                          <span className="text-xs text-gray-500">{customer?.email || "No email provided"}</span>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 text-sm font-bold text-gray-900">
                        LKR {sub.orderId?.total?.toLocaleString() || "0"}
                      </td>

                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${getStatusBadge(
                            sub.status
                          )}`}
                        >
                          {sub.status || "Unknown"}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                        {sub.nextBillingDate
                          ? new Date(sub.nextBillingDate).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })
                          : <span className="text-gray-400">—</span>}
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 text-center">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-700 ring-1 ring-gray-200">
                          {sub.totalInstallmentsPaid}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        {canCancel ? (
                          <button
                            type="button"
                            onClick={() => cancelSubscription(sub._id)}
                            disabled={cancellingId === sub._id}
                            className="inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {cancellingId === sub._id ? "Cancelling..." : "Cancel"}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
