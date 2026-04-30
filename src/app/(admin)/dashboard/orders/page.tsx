"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminFetch } from "@/lib/adminClient";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  ShoppingBag,
  User as UserIcon,
  X,
} from "lucide-react";
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

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface BillingDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  city: string;
}

interface Order {
  _id: string;
  billingDetails: BillingDetails;
  items: OrderItem[];
  total: number;
  orderType?: "normal" | "subscription";
  shippingMethod?: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  trackingNumber?: string | null;
  createdAt: string;
}

type FulfillmentStatus = "unfulfilled" | "fulfilled" | "shipped" | "completed";
type OrderTypeTab = "all" | "normal" | "subscription";
type StatusTab = FulfillmentStatus | "all";

type Toast = {
  message: string;
  type: "success" | "error" | "info";
  id: number;
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [selectedRangePreset, setSelectedRangePreset] = useState<DashboardRangePreset>("all");
  const [dateRange, setDateRange] = useState<DateRangeValue>({ start: "", end: "" });
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [orderTypeTab, setOrderTypeTab] = useState<OrderTypeTab>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [shipDialogOrderId, setShipDialogOrderId] = useState<string | null>(null);
  const [waybillNo, setWaybillNo] = useState("");

  const [toasts, setToasts] = useState<Toast[]>([]);

  const API = process.env.NEXT_PUBLIC_API_URL || "";

  /* ---------------- TOAST HELPER ---------------- */
  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { message, type, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  /* ---------------- FETCH ORDERS ---------------- */
  const fetchOrders = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const res = await adminFetch(`${API}/api/orders?type=all`);
        const data = await res.json();
        const fetchedOrders = Array.isArray(data) ? data : data.orders || [];
        setOrders(fetchedOrders);
      } catch (err) {
        console.error(err);
        showToast("Failed to load orders.", "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [API]
  );

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  /* ---------------- FILTER & SEARCH ---------------- */
  useEffect(() => {
    let list = orders;

    if (orderTypeTab !== "all") {
      list = list.filter((o) => (o.orderType || "normal") === orderTypeTab);
    }

    if (statusTab !== "all") {
      list = list.filter((o) => (o.fulfillmentStatus || "unfulfilled") === statusTab);
    }

    if (dateRange.start) {
      const start = new Date(`${dateRange.start}T00:00:00`);
      list = list.filter((o) => new Date(o.createdAt) >= start);
    }

    if (dateRange.end) {
      const end = new Date(`${dateRange.end}T23:59:59.999`);
      list = list.filter((o) => new Date(o.createdAt) <= end);
    }

    if (search.trim()) {
      const query = search.toLowerCase().trim().replace(/^#/, "");
      const digitsOnlyQuery = query.replace(/\D/g, "");
      list = list.filter(
        (o) =>
          o._id.toLowerCase().includes(query) ||
          o.billingDetails.phone.toLowerCase().includes(query) ||
          (digitsOnlyQuery.length > 0 &&
            o.billingDetails.phone.replace(/\D/g, "").includes(digitsOnlyQuery))
      );
    }

    setFilteredOrders(list);
  }, [dateRange.end, dateRange.start, orderTypeTab, orders, search, statusTab]);

  const handleRangePresetSelect = (preset: DashboardRangePreset) => {
    setSelectedRangePreset(preset);

    if (preset !== "custom") {
      setDateRange(getPresetDateRange(preset));
    }
  };

  /* ---------------- UPDATE STATUS PIPELINE ---------------- */
  const getNextStep = (currentStatus: string): { next: FulfillmentStatus; label: string } | null => {
    const status = (currentStatus || "unfulfilled").toLowerCase();
    switch (status) {
      case "unfulfilled":
        return { next: "fulfilled", label: "Mark Fulfilled" };
      case "fulfilled":
        return { next: "shipped", label: "Mark Shipped" };
      case "shipped":
        return { next: "completed", label: "Mark Completed" };
      default:
        return null; // completed orders have no next step
    }
  };

  const submitOrderStatusUpdate = async (
    orderId: string,
    nextStatus: FulfillmentStatus,
    nextTrackingNumber?: string
  ) => {
    setUpdatingOrderId(orderId);

    try {
      const res = await adminFetch(`${API}/api/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fulfillmentStatus: nextStatus,
          trackingNumber: nextTrackingNumber,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `Failed to update status (${res.status})`);
      }

      const updated = orders.map((o) =>
        o._id === orderId
          ? {
              ...o,
              fulfillmentStatus: nextStatus,
              trackingNumber:
                nextStatus === "shipped"
                  ? nextTrackingNumber || o.trackingNumber || null
                  : o.trackingNumber || null,
            }
          : o
      );

      setOrders(updated);
      
      // Update selected order if it happens to be open in the drawer
      if (selectedOrder?._id === orderId) {
        setSelectedOrder({
          ...selectedOrder,
          fulfillmentStatus: nextStatus,
          trackingNumber:
            nextStatus === "shipped"
              ? nextTrackingNumber || selectedOrder.trackingNumber || null
              : selectedOrder.trackingNumber || null,
        });
      }

      showToast(`Order status updated to ${nextStatus}.`, "success");
      return true;
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : "Failed to update order status.";
      showToast(message, "error");
      return false;
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const advanceOrderStatus = async (
    e: React.MouseEvent,
    orderId: string,
    nextStatus: FulfillmentStatus
  ) => {
    e.stopPropagation(); // Prevents the drawer from opening when clicking the button

    if (nextStatus === "shipped") {
      setShipDialogOrderId(orderId);
      setWaybillNo("");
      return;
    }

    await submitOrderStatusUpdate(orderId, nextStatus);
  };

  /* ---------------- HELPERS ---------------- */
  const getStatusBadge = (statusStr: string) => {
    const normalized = (statusStr || "unfulfilled").toLowerCase();
    switch (normalized) {
      case "completed":
        return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
      case "shipped":
        return "bg-purple-50 text-purple-700 ring-purple-600/20";
      case "fulfilled":
        return "bg-blue-50 text-blue-700 ring-blue-600/20";
      case "unfulfilled":
        return "bg-amber-50 text-amber-700 ring-amber-600/20";
      default:
        return "bg-gray-50 text-gray-600 ring-gray-500/20";
    }
  };

  const formatShippingMethod = (shippingMethod?: string) => {
    if (!shippingMethod) return "Not specified";
    return shippingMethod
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  };

  const hasWaybillNumber = (trackingNumber?: string | null) =>
    typeof trackingNumber === "string" && trackingNumber.trim().length > 0;

  const tabs: StatusTab[] = ["unfulfilled", "fulfilled", "shipped", "completed", "all"];

  const orderTypeCounts = useMemo(
    () => ({
      all: orders.filter((o) => (o.fulfillmentStatus || "unfulfilled") !== "completed").length,
      normal: orders.filter(
        (o) =>
          (o.orderType || "normal") === "normal" &&
          (o.fulfillmentStatus || "unfulfilled") !== "completed"
      ).length,
      subscription: orders.filter(
        (o) =>
          o.orderType === "subscription" &&
          (o.fulfillmentStatus || "unfulfilled") !== "completed"
      ).length,
    }),
    [orders]
  );

  const statusBaseOrders = useMemo(() => {
    if (orderTypeTab === "all") return orders;
    return orders.filter((o) => (o.orderType || "normal") === orderTypeTab);
  }, [orders, orderTypeTab]);

  const statusCounts = useMemo(
    () => ({
      unfulfilled: statusBaseOrders.filter((o) => (o.fulfillmentStatus || "unfulfilled") === "unfulfilled").length,
      fulfilled: statusBaseOrders.filter((o) => (o.fulfillmentStatus || "unfulfilled") === "fulfilled").length,
      shipped: statusBaseOrders.filter((o) => (o.fulfillmentStatus || "unfulfilled") === "shipped").length,
      completed: statusBaseOrders.filter((o) => (o.fulfillmentStatus || "unfulfilled") === "completed").length,
      all: statusBaseOrders.filter((o) => (o.fulfillmentStatus || "unfulfilled") !== "completed").length,
    }),
    [statusBaseOrders]
  );

  const statusSummaryCards = useMemo(
    () => [
      { label: "Unfulfilled", value: statusCounts.unfulfilled },
      { label: "Fulfilled", value: statusCounts.fulfilled },
      { label: "Shipped", value: statusCounts.shipped },
      { label: "Completed", value: statusCounts.completed },
    ],
    [statusCounts]
  );

  if (loading) {
    return <PageLoader icon={ShoppingBag} label="Loading Orders..." />;
  }

  return (
    <section className="min-h-full bg-[#f2fbff] px-4 py-8 md:px-8">
      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-2 rounded-2xl px-5 py-3 text-xs font-black text-white shadow-[0_10px_25px_rgba(0,0,0,0.1)] transition-all animate-in slide-in-from-right-8 pointer-events-auto ${
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
            <ShoppingBag size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Operations</p>
            <h1 className="text-2xl font-black text-[#111]">Order Fulfillment</h1>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => fetchOrders(true)}
            disabled={refreshing}
            className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-[#cfeef7] bg-white px-5 py-3 text-xs font-black text-[#111] transition hover:border-[#03c7fe] disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
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
              placeholder="Search ID or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statusSummaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-[24px] border border-white bg-white/80 p-5 backdrop-blur-xl shadow-[0_20px_50px_rgba(3,199,254,0.08)]"
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">{card.label}</p>
            <p className="mt-2 text-2xl font-black text-[#111]">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Data & Tabs Panel */}
      <Panel className="p-6">
        <div className="mb-6 flex flex-col gap-5 border-b border-[#e0f4fb] pb-5 lg:flex-row lg:items-center lg:justify-between">
          
          {/* Order Type Tabs */}
          <div className="flex w-fit gap-1.5 rounded-2xl border border-[#cfeef7] bg-[#fbfdff] p-1.5">
            <button
              onClick={() => setOrderTypeTab("all")}
              className={`rounded-xl px-4 py-2 text-xs font-black transition-colors ${
                orderTypeTab === "all" ? "bg-[#03c7fe] text-white shadow-sm" : "text-[#888] hover:bg-[#e0f4fb]"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                All Types
                {orderTypeCounts.all > 0 && (
                  <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] ${orderTypeTab === "all" ? "bg-white text-[#03c7fe]" : "bg-[#03c7fe] text-white"}`}>
                    {orderTypeCounts.all}
                  </span>
                )}
              </span>
            </button>
            <button
              onClick={() => setOrderTypeTab("normal")}
              className={`rounded-xl px-4 py-2 text-xs font-black transition-colors ${
                orderTypeTab === "normal" ? "bg-[#03c7fe] text-white shadow-sm" : "text-[#888] hover:bg-[#e0f4fb]"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                Normal
                {orderTypeCounts.normal > 0 && (
                  <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] ${orderTypeTab === "normal" ? "bg-white text-[#03c7fe]" : "bg-[#03c7fe] text-white"}`}>
                    {orderTypeCounts.normal}
                  </span>
                )}
              </span>
            </button>
            <button
              onClick={() => setOrderTypeTab("subscription")}
              className={`rounded-xl px-4 py-2 text-xs font-black transition-colors ${
                orderTypeTab === "subscription" ? "bg-[#03c7fe] text-white shadow-sm" : "text-[#888] hover:bg-[#e0f4fb]"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                Subscription
                {orderTypeCounts.subscription > 0 && (
                  <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] ${orderTypeTab === "subscription" ? "bg-white text-[#03c7fe]" : "bg-[#03c7fe] text-white"}`}>
                    {orderTypeCounts.subscription}
                  </span>
                )}
              </span>
            </button>
          </div>

          {/* Status Tabs */}
          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setStatusTab(t)}
                className={`whitespace-nowrap border-b-2 px-3 py-2 text-[11px] font-black uppercase tracking-wider transition-colors ${
                  statusTab === t
                    ? "border-[#03c7fe] text-[#03c7fe]"
                    : "border-transparent text-[#aaa] hover:border-[#cfeef7] hover:text-[#111]"
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  {t === "all" ? "All Orders" : t}
                  {t !== "completed" && statusCounts[t] > 0 && (
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#03c7fe]/10 px-1 text-[9px] text-[#03c7fe]">
                      {statusCounts[t]}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Order ID</th>
                <th className="px-6 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Customer</th>
                <th className="px-6 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Date</th>
                <th className="px-6 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Total</th>
                <th className="px-6 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Type</th>
                <th className="px-6 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Shipping</th>
                <th className="px-6 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Status</th>
                <th className="px-6 py-3 text-right text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm font-bold text-[#aaa]">
                    No orders found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const step = getNextStep(order.fulfillmentStatus);
                  const isRowUpdating = updatingOrderId === order._id;

                  return (
                    <tr
                      key={order._id}
                      onClick={() => setSelectedOrder(order)}
                      className="cursor-pointer border-t border-[#e0f4fb] transition hover:bg-[#f2fbff]"
                    >
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-black text-[#03c7fe]">
                        #{order._id.slice(-6).toUpperCase()}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-[#111]">
                            {order.billingDetails.firstName} {order.billingDetails.lastName}
                          </span>
                          <span className="text-xs font-bold text-[#aaa]">{order.billingDetails.phone}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-xs font-bold text-[#888]">
                        {new Date(order.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-black text-[#111]">
                        LKR {order.total.toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="inline-flex items-center rounded-full bg-[#f2fbff] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#03c7fe]">
                          {order.orderType || "normal"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-xs font-bold text-[#888]">
                        {formatShippingMethod(order.shippingMethod)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ring-1 ring-inset ${getStatusBadge(
                              order.fulfillmentStatus
                            )}`}
                          >
                            {order.fulfillmentStatus || "unfulfilled"}
                          </span>
                          {hasWaybillNumber(order.trackingNumber) && (
                            <span className="text-[10px] font-black uppercase tracking-wider text-[#888]">
                              Waybill:
                              <span className="ml-1 text-[#111] normal-case">
                                {order.trackingNumber}
                              </span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        {step ? (
                          <button
                            onClick={(e) => advanceOrderStatus(e, order._id, step.next)}
                            disabled={isRowUpdating}
                            className="inline-flex items-center justify-center rounded-xl bg-[#111] px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white transition hover:bg-[#333] disabled:opacity-50"
                          >
                            {isRowUpdating ? "Updating..." : step.label}
                          </button>
                        ) : (
                          <span className="inline-flex items-center text-emerald-500">
                            <CheckCircle2 size={20} />
                          </span>
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

      {/* Slide-Over Drawer for Read-Only Order Details */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-[#111]/20 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedOrder(null)}
          />

          <div className="relative flex w-full max-w-md flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-[#cfeef7] bg-[#fbfdff] px-6 py-5">
              <div className="flex flex-col">
                <h2 className="text-lg font-black text-[#111]">Order Summary</h2>
                <span className="text-xs font-black tracking-widest text-[#03c7fe]">
                  #{selectedOrder._id.slice(-6).toUpperCase()}
                </span>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="rounded-full p-2 text-[#aaa] transition-colors hover:bg-[#f2fbff] hover:text-[#111]"
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-[#fbfdff]">
              
              {/* Status Display */}
              <div className="mb-6 flex items-center justify-between rounded-2xl border border-[#cfeef7] bg-white p-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#888]">Current Status</span>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ring-1 ring-inset ${getStatusBadge(
                    selectedOrder.fulfillmentStatus
                  )}`}
                >
                  {selectedOrder.fulfillmentStatus || "unfulfilled"}
                </span>
              </div>

              <div className="mb-6 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-[#cfeef7] bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#aaa]">Order Type</p>
                  <p className="mt-1 text-sm font-black capitalize text-[#111]">
                    {selectedOrder.orderType || "normal"}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#cfeef7] bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#aaa]">Shipping Method</p>
                  <p className="mt-1 text-sm font-black text-[#111]">
                    {formatShippingMethod(selectedOrder.shippingMethod)}
                  </p>
                </div>
              </div>

              {hasWaybillNumber(selectedOrder.trackingNumber) && (
                <div className="mb-6 rounded-2xl border border-[#cfeef7] bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#aaa]">
                    Waybill Number
                  </p>
                  <p className="mt-1 break-all text-sm font-black text-[#111]">
                    {selectedOrder.trackingNumber}
                  </p>
                </div>
              )}

              {/* Customer Info Card */}
              <div className="flex flex-col gap-4 rounded-2xl border border-[#cfeef7] bg-white p-5">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-[#03c7fe] border-b border-[#e0f4fb] pb-3">
                  Customer Information
                </h3>
                <div className="flex flex-col gap-3 pt-1">
                  <div className="flex items-center gap-3 text-xs text-[#555]">
                    <UserIcon size={16} className="text-[#03c7fe]" />
                    <span className="font-black text-[#111]">{selectedOrder.billingDetails.firstName} {selectedOrder.billingDetails.lastName}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#555]">
                    <Mail size={16} className="text-[#03c7fe]" />
                    <span className="font-bold">{selectedOrder.billingDetails.email}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#555]">
                    <Phone size={16} className="text-[#03c7fe]" />
                    <span className="font-bold">{selectedOrder.billingDetails.phone}</span>
                  </div>
                  <div className="flex items-start gap-3 text-xs text-[#555]">
                    <MapPin size={16} className="text-[#03c7fe] mt-0.5" />
                    <span className="font-bold leading-snug">
                      {selectedOrder.billingDetails.street}<br />
                      {selectedOrder.billingDetails.city}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="mt-6 flex flex-col gap-4">
                <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#03c7fe] border-b border-[#e0f4fb] pb-3">
                  <ShoppingBag size={14} /> Order Items
                </h3>
                <div className="flex flex-col gap-4 pt-1">
                  {selectedOrder.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex flex-col">
                        <span className="font-black text-[#111]">{item.name}</span>
                        <span className="text-[10px] font-bold text-[#aaa]">Qty: {item.quantity}</span>
                      </div>
                      <span className="font-black text-[#111]">
                        LKR {(item.price * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-[#e0f4fb] pt-4">
                  <span className="text-xs font-black uppercase tracking-widest text-[#888]">Total Paid</span>
                  <span className="text-xl font-black text-[#03c7fe]">
                    LKR {selectedOrder.total.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="flex shrink-0 border-t border-[#cfeef7] bg-white px-6 py-5">
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-full rounded-2xl border border-[#cfeef7] bg-white py-3 text-xs font-black text-[#111] transition hover:bg-[#f2fbff]"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Waybill Popup Panel */}
      {shipDialogOrderId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#111]/20 p-4 backdrop-blur-sm">
          <Panel className="flex w-full max-w-sm flex-col overflow-hidden p-6">
            <h3 className="text-lg font-black text-[#111]">Mark As Shipped</h3>
            <p className="mt-1 text-xs font-bold text-[#888]">
              Enter the waybill tracking number to continue.
            </p>
            <div className="mt-5 mb-6">
              <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Waybill Number</label>
              <input
                type="text"
                value={waybillNo}
                onChange={(e) => setWaybillNo(e.target.value)}
                placeholder="e.g. WB123456789"
                className="w-full rounded-2xl border border-[#cfeef7] bg-white px-4 py-3 text-sm font-bold text-[#111] outline-none transition focus:border-[#03c7fe]"
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#e0f4fb]">
              <button
                type="button"
                onClick={() => {
                  setShipDialogOrderId(null);
                  setWaybillNo("");
                }}
                disabled={updatingOrderId === shipDialogOrderId}
                className="rounded-2xl border border-[#cfeef7] bg-white px-5 py-3 text-xs font-black text-[#111] transition hover:bg-[#f2fbff] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!shipDialogOrderId) return;
                  const ok = await submitOrderStatusUpdate(
                    shipDialogOrderId,
                    "shipped",
                    waybillNo.trim()
                  );
                  if (ok) {
                    setShipDialogOrderId(null);
                    setWaybillNo("");
                  }
                }}
                disabled={!waybillNo.trim() || updatingOrderId === shipDialogOrderId}
                className="rounded-2xl bg-[#03c7fe] px-5 py-3 text-xs font-black text-white shadow-[0_10px_25px_rgba(3,199,254,0.3)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {updatingOrderId === shipDialogOrderId ? "Saving..." : "Confirm"}
              </button>
            </div>
          </Panel>
        </div>
      )}
    </section>
  );
}
