"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Mail, MapPin, RefreshCw, Repeat, Search, ShoppingBag, User as UserIcon, X } from "lucide-react";
import { DateRangeValue, SingleCalendarRangePicker } from "@/app/(admin)/dashboard/components/SingleCalendarRangePicker";
import {
  DASHBOARD_RANGE_PRESETS,
  type DashboardRangePreset,
  getPresetDateRange,
} from "@/app/(admin)/dashboard/components/dateRangePresets";
import PageLoader from "@/app/(admin)/dashboard/components/PageLoader";

/* ─── Shared UI Component ────────────────────────────────────────── */
function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[28px] border border-white bg-white/80 backdrop-blur-xl shadow-[0_20px_50px_rgba(3,199,254,0.08)] ${className}`}>
      {children}
    </div>
  );
}

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

interface SubscriptionItem {
  name: string;
  quantity: number;
  price: number;
}

interface Subscription {
  _id: string;
  subscriptionId: string;
  status: string;
  adminViewed?: boolean;
  nextBillingDate: string;
  lastPaymentDate?: string;
  recurrence?: string;
  items: SubscriptionItem[];
  totalInstallmentsPaid: number;
  orderId?: OrderRef | null;
}

type StatusTab = "active" | "cancelled" | "all";

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusTab, setStatusTab] = useState<StatusTab>("active");
  const [selectedRangePreset, setSelectedRangePreset] = useState<DashboardRangePreset>("today");
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => getPresetDateRange("today"));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [sendingReminderEmails, setSendingReminderEmails] = useState(false);
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);
  const [reminderError, setReminderError] = useState<string | null>(null);

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

    if (dateRange.start) {
      const start = new Date(`${dateRange.start}T00:00:00`);
      list = list.filter((sub) => {
        if (!sub.nextBillingDate) return false;
        return new Date(sub.nextBillingDate) >= start;
      });
    }

    if (dateRange.end) {
      const end = new Date(`${dateRange.end}T23:59:59.999`);
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
  }, [dateRange.end, dateRange.start, searchQuery, statusTab, subscriptions]);

  const tabCounts = useMemo(
    () => ({
      active: subscriptions.filter(
        (sub) => (sub.status || "").toLowerCase() === "active" && !sub.adminViewed
      ).length,
      cancelled: subscriptions.filter((sub) => {
        const normalized = (sub.status || "").toLowerCase();
        return (normalized === "cancelled" || normalized === "canceled") && !sub.adminViewed;
      }).length,
      all: subscriptions.filter((sub) => !sub.adminViewed).length,
    }),
    [subscriptions]
  );

  const reminderEligibleSubscriptions = useMemo(() => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 5);

    const targetStart = new Date(targetDate);
    targetStart.setHours(0, 0, 0, 0);

    const targetEnd = new Date(targetDate);
    targetEnd.setHours(23, 59, 59, 999);

    return subscriptions.filter((sub) => {
      const normalizedStatus = (sub.status || "").toLowerCase();

      if (normalizedStatus !== "active" || !sub.nextBillingDate) {
        return false;
      }

      const renewalDate = new Date(sub.nextBillingDate);
      return renewalDate >= targetStart && renewalDate <= targetEnd;
    });
  }, [subscriptions]);

  const handleRangePresetSelect = (preset: DashboardRangePreset) => {
    setSelectedRangePreset(preset);

    if (preset !== "custom") {
      setDateRange(getPresetDateRange(preset));
    }
  };

  const markSubscriptionAsViewed = useCallback(async (subscriptionId: string) => {
    try {
      const res = await fetch(`/api/subscriptions/${subscriptionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminViewed: true }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Failed to mark subscription as viewed (${res.status})`);
      }

      setSubscriptions((prev) =>
        prev.map((sub) =>
          sub._id === subscriptionId ? { ...sub, adminViewed: true } : sub
        )
      );
      setSelectedSubscription((prev) =>
        prev && prev._id === subscriptionId ? { ...prev, adminViewed: true } : prev
      );
    } catch (error) {
      console.error(error);
    }
  }, []);

  const openSubscriptionSummary = useCallback(
    (subscription: Subscription) => {
      setSelectedSubscription(subscription);

      if (!subscription.adminViewed) {
        void markSubscriptionAsViewed(subscription._id);
      }
    },
    [markSubscriptionAsViewed]
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
      setSelectedSubscription((prev) =>
        prev && prev._id === subscriptionId ? { ...prev, status: "cancelled" } : prev
      );
    } catch (error) {
      console.error(error);
    } finally {
      setCancellingId(null);
    }
  };

  const sendReminderEmails = useCallback(async () => {
    setSendingReminderEmails(true);
    setReminderMessage(null);
    setReminderError(null);

    try {
      const res = await fetch("/api/subscriptions/reminders", {
        method: "POST",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || `Failed to send reminder emails (${res.status})`);
      }

      const sentCount = Number(data?.sentCount || 0);
      const skippedCount = Number(data?.skippedCount || 0);
      const parts = [`Sent ${sentCount} reminder email${sentCount === 1 ? "" : "s"}`];

      if (skippedCount > 0) {
        parts.push(`${skippedCount} skipped due to missing email`);
      }

      setReminderMessage(parts.join(". ") + ".");
    } catch (error) {
      console.error(error);
      setReminderError(
        error instanceof Error
          ? error.message
          : "Failed to send reminder emails."
      );
    } finally {
      setSendingReminderEmails(false);
    }
  }, []);

  /* ---------------- HELPERS ---------------- */
  const getStatusBadge = (statusStr: string) => {
    const normalized = (statusStr || "").toLowerCase();
    switch (normalized) {
      case "active":
        return "bg-emerald-50 text-emerald-600 ring-emerald-500/20";
      case "canceled":
      case "cancelled":
        return "bg-red-50 text-red-500 ring-red-500/20";
      case "past_due":
        return "bg-amber-50 text-amber-600 ring-amber-500/20";
      case "pending":
        return "bg-[#f2fbff] text-[#03c7fe] ring-[#03c7fe]/20";
      default:
        return "bg-gray-50 text-[#888] ring-gray-200";
    }
  };

  const formatDisplayDate = (value?: string) => {
    if (!value) return "—";

    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return <PageLoader icon={Repeat} label="Loading Subscriptions..." />;
  }

  return (
    <main className="min-h-screen bg-[#f2fbff] px-4 py-8 md:px-8">
      {/* Page Header Panel */}
      <Panel className="mb-6 flex flex-col gap-6 p-7 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#03c7fe] text-white shadow-[0_8px_20px_rgba(3,199,254,0.3)]">
              <Repeat size={22} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Operations</p>
              <h1 className="text-2xl font-black text-[#111]">Subscriptions</h1>
            </div>
          </div>
          
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            {reminderEligibleSubscriptions.length > 0 && (
              <button
                type="button"
                onClick={sendReminderEmails}
                disabled={sendingReminderEmails}
                className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-[#111] px-5 py-3 text-xs font-black text-white transition hover:scale-[1.02] disabled:opacity-50"
              >
                <Mail size={14} />
                {sendingReminderEmails ? "Sending..." : `Send Reminders (${reminderEligibleSubscriptions.length})`}
              </button>
            )}
            <button
              type="button"
              onClick={() => loadSubscriptions(true)}
              disabled={refreshing}
              className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-[#cfeef7] bg-white px-5 py-3 text-xs font-black text-[#111] transition hover:border-[#03c7fe] disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>

        {(reminderMessage || reminderError) && (
          <div className="mt-4 w-full">
            <div
              className={`rounded-2xl border px-5 py-3 text-xs font-black ${
                reminderError
                  ? "border-red-200 bg-red-50 text-red-600"
                  : "border-[#cfeef7] bg-[#e0f4fb] text-[#03c7fe]"
              }`}
            >
              {reminderError || reminderMessage}
            </div>
          </div>
        )}
      </Panel>

      <Panel className="mb-6 p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          {DASHBOARD_RANGE_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => handleRangePresetSelect(preset.key)}
              className={`rounded-2xl px-4 py-2 text-xs font-black transition hover:scale-[1.02] ${
                selectedRangePreset === preset.key
                  ? "bg-[#03c7fe] text-white shadow-[0_6px_18px_rgba(3,199,254,0.3)]"
                  : "border border-[#cfeef7] bg-white text-[#555]"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aaa]" />
            <input
              type="text"
              placeholder="Search subscriptions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-[#cfeef7] bg-white py-3 pl-10 pr-4 text-xs font-bold text-[#111] outline-none transition focus:border-[#03c7fe] focus:ring-2 focus:ring-[#03c7fe]/20"
            />
          </div>

          <div className="rounded-2xl border border-[#cfeef7] bg-white">
            <SingleCalendarRangePicker
              value={dateRange}
              onChange={(nextRange) => {
                setSelectedRangePreset("custom");
                setDateRange(nextRange);
              }}
            />
          </div>
        </div>
      </Panel>

      {/* Tabs & Data Panel */}
      <Panel className="p-6">
        <div className="mb-6 flex flex-col gap-5 border-b border-[#e0f4fb] pb-5 lg:flex-row lg:items-center lg:justify-between">
          {/* Status Tabs */}
          <div className="flex w-fit gap-1.5 rounded-2xl border border-[#cfeef7] bg-[#fbfdff] p-1.5">
            <button
              onClick={() => setStatusTab("active")}
              className={`rounded-xl px-4 py-2 text-xs font-black transition-colors ${
                statusTab === "active" ? "bg-[#03c7fe] text-white shadow-sm" : "text-[#888] hover:bg-[#e0f4fb]"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                Active
                {tabCounts.active > 0 && (
                  <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] ${statusTab === "active" ? "bg-white text-[#03c7fe]" : "bg-[#03c7fe] text-white"}`}>
                    {tabCounts.active}
                  </span>
                )}
              </span>
            </button>
            <button
              onClick={() => setStatusTab("cancelled")}
              className={`rounded-xl px-4 py-2 text-xs font-black transition-colors ${
                statusTab === "cancelled" ? "bg-[#03c7fe] text-white shadow-sm" : "text-[#888] hover:bg-[#e0f4fb]"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                Cancelled
                {tabCounts.cancelled > 0 && (
                  <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] ${statusTab === "cancelled" ? "bg-white text-[#03c7fe]" : "bg-[#03c7fe] text-white"}`}>
                    {tabCounts.cancelled}
                  </span>
                )}
              </span>
            </button>
            <button
              onClick={() => setStatusTab("all")}
              className={`rounded-xl px-4 py-2 text-xs font-black transition-colors ${
                statusTab === "all" ? "bg-[#03c7fe] text-white shadow-sm" : "text-[#888] hover:bg-[#e0f4fb]"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                All
                {tabCounts.all > 0 && (
                  <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] ${statusTab === "all" ? "bg-white text-[#03c7fe]" : "bg-[#03c7fe] text-white"}`}>
                    {tabCounts.all}
                  </span>
                )}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#888]">Total Active:</span>
            <span className="rounded-full bg-[#f2fbff] px-3 py-1 text-xs font-black text-[#03c7fe]">
              {subscriptions.filter(s => s.status.toLowerCase() === 'active').length}
            </span>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Sub ID</th>
                <th className="px-6 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Customer</th>
                <th className="px-6 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Amount</th>
                <th className="px-6 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Status</th>
                <th className="px-6 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Next Billing</th>
                <th className="px-6 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Last Payment</th>
                <th className="px-6 py-3 text-center text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Payments Made</th>
                <th className="px-6 py-3 text-right text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubscriptions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm font-bold text-[#aaa]">
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
                  const lastPaymentDate = sub.lastPaymentDate || sub.orderId?.createdAt;

                  return (
                    <tr
                      key={sub._id}
                      onClick={() => openSubscriptionSummary(sub)}
                      className="cursor-pointer border-t border-[#e0f4fb] transition hover:bg-[#f2fbff]"
                    >
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-black text-[#03c7fe]">
                        {sub.subscriptionId}
                      </td>
                      
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-[#111]">
                            {customer?.firstName || "Unknown"} {customer?.lastName || ""}
                          </span>
                          <span className="text-xs font-bold text-[#aaa]">{customer?.email || "No email provided"}</span>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 text-sm font-black text-[#111]">
                        LKR {sub.orderId?.total?.toLocaleString() || "0"}
                      </td>

                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ring-1 ring-inset ${getStatusBadge(
                            sub.status
                          )}`}
                        >
                          {sub.status || "Unknown"}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 text-xs font-bold text-[#888]">
                        {sub.nextBillingDate
                          ? formatDisplayDate(sub.nextBillingDate)
                          : <span className="text-[#aaa]">—</span>}
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 text-xs font-bold text-[#888]">
                        {lastPaymentDate
                          ? formatDisplayDate(lastPaymentDate)
                          : <span className="text-[#aaa]">—</span>}
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 text-center">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#f2fbff] text-xs font-black text-[#03c7fe]">
                          {sub.totalInstallmentsPaid}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        {canCancel ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              cancelSubscription(sub._id);
                            }}
                            disabled={cancellingId === sub._id}
                            className="inline-flex items-center justify-center rounded-xl bg-red-500 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white transition hover:bg-red-600 disabled:opacity-50"
                          >
                            {cancellingId === sub._id ? "Cancelling..." : "Cancel"}
                          </button>
                        ) : (
                          <span className="text-xs text-[#aaa]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Slide-Over Drawer for Read-Only Details */}
      {selectedSubscription && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-[#111]/20 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedSubscription(null)}
          />

          <div className="relative flex w-full max-w-md flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between border-b border-[#cfeef7] bg-[#fbfdff] px-6 py-5">
              <div className="flex flex-col">
                <h2 className="text-lg font-black text-[#111]">Subscription Summary</h2>
                <span className="text-xs font-black tracking-widest text-[#03c7fe]">
                  {selectedSubscription.subscriptionId}
                </span>
              </div>
              <button
                onClick={() => setSelectedSubscription(null)}
                className="rounded-full p-2 text-[#aaa] transition-colors hover:bg-[#f2fbff] hover:text-[#111]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-[#fbfdff]">
              <div className="mb-6 space-y-4">
                <div className="flex items-center justify-between rounded-2xl border border-[#cfeef7] bg-white p-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#888]">Current Status</span>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ring-1 ring-inset ${getStatusBadge(
                      selectedSubscription.status
                    )}`}
                  >
                    {selectedSubscription.status || "Unknown"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-[#cfeef7] bg-white p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#aaa]">Next Billing</p>
                    <p className="mt-1 text-sm font-black text-[#111]">
                      {formatDisplayDate(selectedSubscription.nextBillingDate)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#cfeef7] bg-white p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#aaa]">Last Payment</p>
                    <p className="mt-1 text-sm font-black text-[#111]">
                      {formatDisplayDate(
                        selectedSubscription.lastPaymentDate ||
                          selectedSubscription.orderId?.createdAt
                      )}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#cfeef7] bg-white p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#aaa]">Recurrence</p>
                    <p className="mt-1 text-sm font-black text-[#111]">
                      {selectedSubscription.recurrence || "1 Month"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#cfeef7] bg-white p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#aaa]">Payments Made</p>
                    <p className="mt-1 text-sm font-black text-[#111]">
                      {selectedSubscription.totalInstallmentsPaid}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4 rounded-2xl border border-[#cfeef7] bg-white p-5">
                <h3 className="border-b border-[#e0f4fb] pb-3 text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
                  Customer Information
                </h3>
                <div className="flex flex-col gap-3 pt-1">
                  <div className="flex items-center gap-3 text-xs text-[#555]">
                    <UserIcon size={16} className="text-[#03c7fe]" />
                    <span className="font-black text-[#111]">
                      {selectedSubscription.orderId?.billingDetails?.firstName || "Unknown"}{" "}
                      {selectedSubscription.orderId?.billingDetails?.lastName || ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#555]">
                    <Mail size={16} className="text-[#03c7fe]" />
                    <span className="font-bold">{selectedSubscription.orderId?.billingDetails?.email || "No email provided"}</span>
                  </div>
                  <div className="flex items-start gap-3 text-xs text-[#555]">
                    <MapPin size={16} className="mt-0.5 text-[#03c7fe]" />
                    <span className="font-bold leading-snug">Linked to original subscription order</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-4">
                <h3 className="flex items-center gap-2 border-b border-[#e0f4fb] pb-3 text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
                  <ShoppingBag size={14} /> Subscription Items
                </h3>
                <div className="flex flex-col gap-4 pt-1">
                  {selectedSubscription.items?.length ? (
                    selectedSubscription.items.map((item, index) => (
                      <div key={`${selectedSubscription._id}-${index}`} className="flex items-center justify-between text-sm">
                        <div className="flex flex-col">
                          <span className="font-black text-[#111]">{item.name}</span>
                          <span className="text-[10px] font-bold text-[#aaa]">Qty: {item.quantity}</span>
                        </div>
                        <span className="font-black text-[#111]">
                          LKR {(item.price * item.quantity).toLocaleString()}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs font-bold text-[#aaa]">No subscription items available.</p>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-[#e0f4fb] pt-4">
                  <span className="text-xs font-black uppercase tracking-widest text-[#888]">Recurring Amount</span>
                  <span className="text-xl font-black text-[#03c7fe]">
                    LKR {selectedSubscription.orderId?.total?.toLocaleString() || "0"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 border-t border-[#cfeef7] bg-white px-6 py-5">
              <button
                onClick={() => setSelectedSubscription(null)}
                className="w-full rounded-2xl border border-[#cfeef7] bg-white py-3 text-xs font-black text-[#111] transition hover:bg-[#f2fbff]"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
