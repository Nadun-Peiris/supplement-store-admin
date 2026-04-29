"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CreditCard,
  Mail,
  Phone,
  RefreshCw,
  Search,
  ShoppingBag,
  User as UserIcon,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import PageLoader from "@/app/(admin)/dashboard/components/PageLoader";
import {
  DateRangeValue,
  SingleCalendarRangePicker,
} from "@/app/(admin)/dashboard/components/SingleCalendarRangePicker";
import {
  DASHBOARD_RANGE_PRESETS,
  type DashboardRangePreset,
  getPresetDateRange,
} from "@/app/(admin)/dashboard/components/dateRangePresets";

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[28px] border border-white bg-white/80 backdrop-blur-xl shadow-[0_20px_50px_rgba(3,199,254,0.08)] ${className}`}
    >
      {children}
    </div>
  );
}

type OrderItem = {
  name?: string;
  quantity?: number;
  price?: number;
  lineTotal?: number;
};

type BillingDetails = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  street?: string;
  city?: string;
  country?: string;
  postcode?: string;
  apartment?: string;
};

type Order = {
  _id: string;
  items?: OrderItem[];
  total?: number;
  orderType?: "normal" | "subscription";
  paymentStatus?: "pending" | "paid" | "failed" | "refunded";
  fulfillmentStatus?: "unfulfilled" | "fulfilled" | "shipped" | "completed";
  billingDetails?: BillingDetails;
  createdAt?: string;
};

type OrderSummary = {
  id: string;
  customerName: string;
  email: string;
  phone: string;
  dateLabel: string;
  total: number;
  orderType: string;
  fulfillmentStatus: string;
  address: string;
  items: Array<{
    name: string;
    quantity: number;
    lineTotal: number;
  }>;
};

const currencyFormatter = new Intl.NumberFormat("en-LK", {
  style: "currency",
  currency: "LKR",
  maximumFractionDigits: 0,
});

const shortDateTimeFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const getCustomerName = (billing?: BillingDetails) => {
  const fullName = `${billing?.firstName || ""} ${billing?.lastName || ""}`.trim();
  return fullName || "Unknown customer";
};

const getCustomerAddress = (billing?: BillingDetails) =>
  [
    billing?.street,
    billing?.apartment,
    billing?.city,
    billing?.country,
    billing?.postcode,
  ]
    .filter(Boolean)
    .join(", ") || "Address unavailable";

const getStatusBadge = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized === "completed") {
    return "bg-emerald-50 text-emerald-600 ring-emerald-500/20";
  }
  if (normalized === "shipped") {
    return "bg-purple-50 text-purple-600 ring-purple-500/20";
  }
  if (normalized === "fulfilled") {
    return "bg-blue-50 text-blue-600 ring-blue-500/20";
  }
  if (normalized === "paid") {
    return "bg-emerald-50 text-emerald-600 ring-emerald-500/20";
  }
  if (normalized === "pending") {
    return "bg-amber-50 text-amber-600 ring-amber-500/20";
  }
  if (normalized === "failed" || normalized === "cancelled") {
    return "bg-red-50 text-red-600 ring-red-500/20";
  }
  return "bg-[#f2fbff] text-[#03c7fe] ring-[#03c7fe]/20";
};

const parseFilterStart = (value: string) => new Date(`${value}T00:00:00`);
const parseFilterEnd = (value: string) => new Date(`${value}T23:59:59.999`);

export default function PendingPaymentsPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [selectedRangePreset, setSelectedRangePreset] = useState<DashboardRangePreset>("all");
  const [dateRange, setDateRange] = useState<DateRangeValue>({ start: "", end: "" });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderSummary | null>(null);

  const fetchOrders = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      setError(null);
      const response = await fetch("/api/orders?type=all");
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load pending payment orders.");
      }

      const allOrders = Array.isArray(payload.orders)
        ? payload.orders
        : Array.isArray(payload)
          ? payload
          : [];

      setOrders(allOrders);
    } catch (fetchError) {
      console.error(fetchError);
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Unable to load pending payment orders."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  const pendingOrders = useMemo(() => {
    const pending = orders
      .filter((order) => (order.paymentStatus || "pending").toLowerCase() === "pending")
      .filter((order) => {
        const createdAt = new Date(order.createdAt || 0);

        if (dateRange.start && createdAt < parseFilterStart(dateRange.start)) {
          return false;
        }

        if (dateRange.end && createdAt > parseFilterEnd(dateRange.end)) {
          return false;
        }

        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );

    if (!search.trim()) {
      return pending;
    }

    const query = search.toLowerCase().trim().replace(/^#/, "");
    const digitsOnlyQuery = query.replace(/\D/g, "");

    return pending.filter((order) => {
      const id = order._id.toLowerCase();
      const customerName = getCustomerName(order.billingDetails).toLowerCase();
      const email = (order.billingDetails?.email || "").toLowerCase();
      const phone = (order.billingDetails?.phone || "").toLowerCase();

      return (
        id.includes(query) ||
        customerName.includes(query) ||
        email.includes(query) ||
        phone.includes(query) ||
        (digitsOnlyQuery.length > 0 && phone.replace(/\D/g, "").includes(digitsOnlyQuery))
      );
    });
  }, [dateRange.end, dateRange.start, orders, search]);

  const handleRangePresetSelect = (preset: DashboardRangePreset) => {
    setSelectedRangePreset(preset);

    if (preset !== "custom") {
      setDateRange(getPresetDateRange(preset));
    }
  };

  if (loading) {
    return (
      <PageLoader
        icon={CreditCard}
        label="Loading Pending Payments..."
      />
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#f2fbff] px-4 py-8 md:px-8">
        <Panel className="mx-auto max-w-xl p-8 text-center shadow-[0_30px_60px_rgba(239,68,68,0.12)]">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
            <AlertCircle size={30} />
          </div>
          <h1 className="text-2xl font-black text-[#111]">Pending payments unavailable</h1>
          <p className="mt-3 text-xs font-bold leading-6 text-[#888]">{error}</p>
          <button
            type="button"
            onClick={() => void fetchOrders()}
            className="mt-6 rounded-2xl bg-[#03c7fe] px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-[0_10px_25px_rgba(3,199,254,0.3)] transition hover:scale-[1.02]"
          >
            Reload Page
          </button>
        </Panel>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f2fbff] px-4 py-8 md:px-8">
      <Panel className="mb-6 flex flex-col gap-6 p-7 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#03c7fe] text-white shadow-[0_8px_20px_rgba(3,199,254,0.3)]">
            <CreditCard size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
              Operations
            </p>
            <h1 className="text-2xl font-black text-[#111]">Pending Payments</h1>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => void fetchOrders(true)}
            className="inline-flex items-center gap-2 rounded-2xl border border-[#cfeef7] bg-white px-5 py-3 text-xs font-black text-[#111] transition hover:border-[#03c7fe] hover:text-[#03c7fe]"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard/orders")}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#03c7fe] px-5 py-3 text-xs font-black text-white shadow-[0_10px_25px_rgba(3,199,254,0.3)] transition hover:scale-[1.02]"
          >
            All Orders <ArrowRight size={14} />
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
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Order ID, name, email, phone"
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

      <Panel className="p-6">
        <div className="mb-6 flex flex-col gap-5 border-b border-[#e0f4fb] pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
              Payment Queue
            </p>
            <h2 className="mt-1 text-xl font-black text-[#111]">Orders awaiting payment</h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse">
            <thead>
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
                  Order
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
                  Customer
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
                  Date
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
                  Total
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
                  Type
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
                  Fulfillment
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
                  Payment
                </th>
              </tr>
            </thead>
            <tbody>
              {pendingOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm font-bold text-[#888]">
                    No pending payment orders found.
                  </td>
                </tr>
              ) : (
                pendingOrders.map((order) => {
                  const createdAt = new Date(order.createdAt || 0);
                  const orderSummary: OrderSummary = {
                    id: order._id,
                    customerName: getCustomerName(order.billingDetails),
                    email: order.billingDetails?.email || "No email",
                    phone: order.billingDetails?.phone || "No phone",
                    dateLabel: shortDateTimeFormatter.format(createdAt),
                    total: order.total ?? 0,
                    orderType: order.orderType || "normal",
                    fulfillmentStatus: order.fulfillmentStatus || "unfulfilled",
                    address: getCustomerAddress(order.billingDetails),
                    items:
                      order.items?.map((item) => ({
                        name: item.name?.trim() || "Unnamed product",
                        quantity: item.quantity ?? 0,
                        lineTotal: item.lineTotal ?? (item.price ?? 0) * (item.quantity ?? 0),
                      })) || [],
                  };

                  return (
                    <tr
                      key={order._id}
                      className="cursor-pointer border-t border-[#e0f4fb] transition hover:bg-[#f2fbff]"
                      onClick={() => setSelectedOrder(orderSummary)}
                    >
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-black text-amber-600">
                        #{order._id.slice(-6).toUpperCase()}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-black text-[#111]">
                          {getCustomerName(order.billingDetails)}
                        </p>
                        <p className="mt-1 text-[10px] font-bold text-[#aaa]">
                          {order.billingDetails?.email || "No email"}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-xs font-bold text-[#888]">
                        {shortDateTimeFormatter.format(createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-black text-[#111]">
                        {currencyFormatter.format(order.total ?? 0)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-xs font-black uppercase tracking-wider text-[#888]">
                        {order.orderType || "normal"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ring-1 ring-inset ${getStatusBadge(
                            order.fulfillmentStatus || "unfulfilled"
                          )}`}
                        >
                          {order.fulfillmentStatus || "unfulfilled"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ring-1 ring-inset ${getStatusBadge(
                            order.paymentStatus || "pending"
                          )}`}
                        >
                          {order.paymentStatus || "pending"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {selectedOrder && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div
            className="absolute inset-0 bg-[#111]/20 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedOrder(null)}
          />
          <div className="relative flex w-full max-w-xl flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#cfeef7] bg-[#fbfdff] px-6 py-5">
              <div>
                <h2 className="text-lg font-black text-[#111]">Order summary</h2>
                <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-amber-600">
                  #{selectedOrder.id.slice(-6).toUpperCase()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="rounded-full p-2 text-[#aaa] transition hover:bg-[#f2fbff] hover:text-[#111]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-white p-6">
              <div className="mb-6 grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-[#cfeef7] bg-[#fbfdff] px-5 py-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#888]">
                    Fulfillment
                  </p>
                  <span
                    className={`mt-2 inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ring-1 ring-inset ${getStatusBadge(
                      selectedOrder.fulfillmentStatus
                    )}`}
                  >
                    {selectedOrder.fulfillmentStatus}
                  </span>
                </div>
                <div className="rounded-2xl border border-[#cfeef7] bg-[#fbfdff] px-5 py-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#888]">
                    Payment
                  </p>
                  <span className="mt-2 inline-flex rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-amber-600 ring-1 ring-inset ring-amber-500/20">
                    pending
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-[#cfeef7] bg-[#fbfdff] p-5">
                <h3 className="border-b border-[#e0f4fb] pb-3 text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
                  Customer details
                </h3>
                <div className="mt-4 space-y-4 text-xs font-bold text-[#555]">
                  <div className="flex items-center gap-3">
                    <UserIcon size={16} className="text-[#03c7fe]" />
                    <span>{selectedOrder.customerName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail size={16} className="text-[#03c7fe]" />
                    <span>{selectedOrder.email}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone size={16} className="text-[#03c7fe]" />
                    <span>{selectedOrder.phone}</span>
                  </div>
                  <p className="leading-relaxed">
                    <span className="font-black text-[#111]">Address:</span> {selectedOrder.address}
                  </p>
                  <p>
                    <span className="font-black text-[#111]">Order date:</span> {selectedOrder.dateLabel}
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-[#cfeef7] bg-[#fbfdff] p-5">
                <div className="flex items-center justify-between border-b border-[#e0f4fb] pb-3">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
                    Order items
                  </h3>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#888]">
                    {selectedOrder.items.length} items
                  </span>
                </div>
                <div className="mt-4 space-y-5">
                  {selectedOrder.items.length === 0 ? (
                    <p className="text-xs font-bold text-[#888]">No item lines available.</p>
                  ) : (
                    selectedOrder.items.map((item, index) => (
                      <div
                        key={`${item.name}-${index}`}
                        className="flex items-center justify-between gap-4"
                      >
                        <div>
                          <p className="text-sm font-black text-[#111]">{item.name}</p>
                          <p className="mt-1 text-[10px] font-bold text-[#aaa]">
                            Qty {item.quantity}
                          </p>
                        </div>
                        <p className="text-sm font-black text-[#111]">
                          {currencyFormatter.format(item.lineTotal)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-[#e0f4fb] pt-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#888]">
                    Outstanding total
                  </span>
                  <span className="text-xl font-black text-amber-600">
                    {currencyFormatter.format(selectedOrder.total)}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t border-[#cfeef7] bg-white px-6 py-5">
              <button
                type="button"
                onClick={() => router.push("/dashboard/orders")}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#03c7fe] py-4 text-xs font-black uppercase tracking-widest text-white shadow-[0_10px_25px_rgba(3,199,254,0.3)] transition hover:scale-[1.02]"
              >
                <ShoppingBag size={14} />
                Open Full Orders View
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
