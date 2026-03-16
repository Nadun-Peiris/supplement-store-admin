"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
        const res = await fetch(`${API}/api/orders?type=all`);
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
      const res = await fetch(`${API}/api/orders/${orderId}`, {
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

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <h2 className="text-lg font-semibold text-gray-500">Loading orders...</h2>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 relative min-h-[80vh]">
      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg transition-all animate-in slide-in-from-right-8 pointer-events-auto ${
              toast.type === "success"
                ? "bg-emerald-600"
                : toast.type === "error"
                ? "bg-red-600"
                : "bg-gray-800"
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
      <header className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
            <p className="text-sm text-gray-500">Manage and track customer purchases.</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => fetchOrders(true)}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            <SingleCalendarRangePicker value={dateRange} onChange={setDateRange} />
            <div className="relative w-full sm:w-80">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by phone number or Order ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 outline-none transition-colors focus:border-[#01C7FE] focus:ring-1 focus:ring-[#01C7FE]"
              />
            </div>
          </div>
        </div>

        {/* Order Type Tabs */}
        <div className="flex w-fit gap-2 rounded-lg border border-gray-200 bg-white p-1">
          <button
            onClick={() => setOrderTypeTab("all")}
            className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${
              orderTypeTab === "all"
                ? "bg-[#01C7FE] text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              All Types
              {orderTypeCounts.all > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
                  {orderTypeCounts.all}
                </span>
              )}
            </span>
          </button>
          <button
            onClick={() => setOrderTypeTab("normal")}
            className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${
              orderTypeTab === "normal"
                ? "bg-[#01C7FE] text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              Normal
              {orderTypeCounts.normal > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
                  {orderTypeCounts.normal}
                </span>
              )}
            </span>
          </button>
          <button
            onClick={() => setOrderTypeTab("subscription")}
            className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${
              orderTypeTab === "subscription"
                ? "bg-[#01C7FE] text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              Subscription
              {orderTypeCounts.subscription > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
                  {orderTypeCounts.subscription}
                </span>
              )}
            </span>
          </button>
        </div>

        {/* Status Tabs */}
        <div className="flex gap-2 overflow-x-auto border-b border-gray-200 pb-px hide-scrollbar">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setStatusTab(t)}
              className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold transition-colors capitalize ${
                statusTab === t
                  ? "border-[#01C7FE] text-[#01C7FE]"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-900"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                {t === "all" ? "All Orders" : t}
                {t !== "completed" && statusCounts[t] > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
                    {statusCounts[t]}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </header>

      {/* Data Table */}
      <main className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Order ID</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Date</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Total</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-gray-500">
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
                      className="cursor-pointer transition-colors hover:bg-gray-50"
                    >
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-[#01C7FE]">
                        #{order._id.slice(-6).toUpperCase()}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-gray-900">
                            {order.billingDetails.firstName} {order.billingDetails.lastName}
                          </span>
                          <span className="text-xs text-gray-500">{order.billingDetails.phone}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                        {new Date(order.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-bold text-gray-900">
                        LKR {order.total.toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium capitalize text-gray-700">
                          {order.orderType || "normal"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${getStatusBadge(
                            order.fulfillmentStatus
                          )}`}
                        >
                          {order.fulfillmentStatus || "unfulfilled"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        {step ? (
                          <button
                            onClick={(e) => advanceOrderStatus(e, order._id, step.next)}
                            disabled={isRowUpdating}
                            className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isRowUpdating ? "Updating..." : step.label}
                          </button>
                        ) : (
                          <span className="inline-flex items-center text-emerald-600">
                            <CheckCircle2 size={18} />
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
      </main>

      {/* Slide-Over Drawer for Read-Only Order Details */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedOrder(null)}
          />

          {/* Drawer Panel */}
          <div className="relative flex w-full max-w-md flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 bg-gray-50">
              <div className="flex flex-col">
                <h2 className="text-lg font-bold text-gray-900">Order Summary</h2>
                <span className="text-sm font-semibold text-[#01C7FE]">
                  #{selectedOrder._id.slice(-6).toUpperCase()}
                </span>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-900"
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6">
              
              {/* Status Display */}
              <div className="mb-6 flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 p-4">
                <span className="text-sm font-semibold text-gray-600">Current Status</span>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold capitalize ring-1 ring-inset ${getStatusBadge(
                    selectedOrder.fulfillmentStatus
                  )}`}
                >
                  {selectedOrder.fulfillmentStatus || "unfulfilled"}
                </span>
              </div>

              {/* Customer Info Card */}
              <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">Customer Information</h3>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3 text-sm text-gray-700">
                    <UserIcon size={16} className="text-gray-400" />
                    <span className="font-medium">{selectedOrder.billingDetails.firstName} {selectedOrder.billingDetails.lastName}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-700">
                    <Mail size={16} className="text-gray-400" />
                    <span>{selectedOrder.billingDetails.email}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-700">
                    <Phone size={16} className="text-gray-400" />
                    <span>{selectedOrder.billingDetails.phone}</span>
                  </div>
                  <div className="flex items-start gap-3 text-sm text-gray-700">
                    <MapPin size={16} className="text-gray-400 mt-0.5" />
                    <span className="leading-snug">
                      {selectedOrder.billingDetails.street}<br />
                      {selectedOrder.billingDetails.city}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="mt-6 flex flex-col gap-4">
                <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 border-b border-gray-200 pb-2">
                  <ShoppingBag size={18} className="text-[#01C7FE]" />
                  Order Items
                </h3>
                <div className="flex flex-col gap-3">
                  {selectedOrder.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-900">{item.name}</span>
                        <span className="text-xs text-gray-500">Qty: {item.quantity}</span>
                      </div>
                      <span className="font-bold text-gray-900">
                        LKR {(item.price * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-3">
                  <span className="text-sm font-semibold text-gray-600">Total Paid</span>
                  <span className="text-lg font-bold text-[#01C7FE]">
                    LKR {selectedOrder.total.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Drawer Footer (View Only) */}
            <div className="flex shrink-0 border-t border-gray-200 bg-gray-50 px-6 py-4">
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-full rounded-lg border border-gray-300 bg-white py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-100"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Waybill Popup */}
      {shipDialogOrderId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-sm sm:p-6">
          <div className="flex w-full max-w-sm flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900">Mark As Shipped</h3>
              <p className="mt-2 text-sm text-gray-500">
                Enter the waybill number to continue.
              </p>
              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium text-gray-700">Waybill No</label>
                <input
                  type="text"
                  value={waybillNo}
                  onChange={(e) => setWaybillNo(e.target.value)}
                  placeholder="e.g. WB123456789"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-[#01C7FE] focus:ring-1 focus:ring-[#01C7FE]"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setShipDialogOrderId(null);
                  setWaybillNo("");
                }}
                disabled={updatingOrderId === shipDialogOrderId}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
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
                className="rounded-lg bg-[#01C7FE] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#00b3e6] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {updatingOrderId === shipDialogOrderId ? "Saving..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
