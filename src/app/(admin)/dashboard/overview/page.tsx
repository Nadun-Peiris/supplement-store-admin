"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BadgeDollarSign,
  Boxes,
  CalendarClock,
  CalendarRange,
  CreditCard,
  LayoutDashboard,
  ShieldCheck,
  ShoppingBag,
  Users,
  X,
  Package,
} from "lucide-react";
import {
  DateRangeValue,
  SingleCalendarRangePicker,
} from "@/app/(admin)/dashboard/components/SingleCalendarRangePicker";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

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

type UserRecord = {
  _id: string;
  fullName: string;
  email: string;
  role: "customer" | "admin" | "superadmin";
  isBlocked: boolean;
  createdAt?: string;
};

type ProductRecord = {
  _id: string;
  name: string;
  stock?: number;
  price?: number;
  category?: string;
  brandName?: string;
  isActive?: boolean;
  createdAt?: string;
};

type OrderRef = {
  billingDetails?: BillingDetails;
  total?: number;
  createdAt?: string;
};

type Subscription = {
  _id: string;
  subscriptionId: string;
  status?: "active" | "cancelled" | "completed";
  nextBillingDate?: string;
  lastPaymentDate?: string;
  recurrence?: string;
  totalInstallmentsPaid?: number;
  items?: OrderItem[];
  orderId?: OrderRef | null;
  createdAt?: string;
};

type DashboardData = {
  orders: Order[];
  users: UserRecord[];
  products: ProductRecord[];
  subscriptions: Subscription[];
};

type OrderSummary = {
  id: string;
  customerName: string;
  email: string;
  phone: string;
  dateLabel: string;
  dateValue: number;
  total: number;
  status: string;
  paymentStatus: string;
  orderType: string;
  address: string;
  items: Array<{
    name: string;
    quantity: number;
    lineTotal: number;
  }>;
};

type RangePreset = "today" | "7d" | "30d" | "90d" | "12m" | "all" | "custom";

/* ─── Shared UI Components ───────────────────────────────────────── */
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

function PanelHead({ title, sub, icon }: { title: string; sub: string; icon?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-2">
      <div>
        <h2 className="text-base font-black text-[#111]">{title}</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-[#888]">{sub}</p>
      </div>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
    </div>
  );
}

/* ─── Helpers ────────────────────────────────────────────────────── */

const currencyFormatter = new Intl.NumberFormat("en-LK", {
  style: "currency",
  currency: "LKR",
  maximumFractionDigits: 0,
});

const compactNumberFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const monthYearFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  year: "2-digit",
});

const shortDayFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
});

const shortDateTimeFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const pieColors = ["#03c7fe", "#0ea5e9", "#38bdf8", "#7dd3fc", "#bae6fd"];

const getToken = () =>
  document.cookie
    .split("; ")
    .find((row) => row.startsWith("firebaseToken="))
    ?.split("=")[1];

const getCustomerName = (billing?: BillingDetails) => {
  const fullName = `${billing?.firstName || ""} ${billing?.lastName || ""}`.trim();
  return fullName || "Unknown customer";
};

const getCustomerAddress = (billing?: BillingDetails) =>
  [billing?.street, billing?.apartment, billing?.city, billing?.country, billing?.postcode]
    .filter(Boolean)
    .join(", ") || "Address unavailable";

const parseFilterStart = (value: string) => new Date(`${value}T00:00:00`);
const parseFilterEnd = (value: string) => new Date(`${value}T23:59:59.999`);

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getPresetDateRange = (preset: Exclude<RangePreset, "custom">): DateRangeValue => {
  if (preset === "all") {
    return { start: "", end: "" };
  }

  const now = new Date();
  const end = endOfDay(now);
  const start = startOfDay(now);

  if (preset === "today") {
    return {
      start: formatDateInput(start),
      end: formatDateInput(end),
    };
  }

  if (preset === "7d") {
    start.setDate(start.getDate() - 6);
  } else if (preset === "30d") {
    start.setDate(start.getDate() - 29);
  } else if (preset === "90d") {
    start.setDate(start.getDate() - 89);
  } else if (preset === "12m") {
    start.setMonth(start.getMonth() - 11);
  }

  return {
    start: formatDateInput(start),
    end: formatDateInput(end),
  };
};

const isWithinRange = (value: string | undefined, range: DateRangeValue) => {
  if (!value) return false;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  if (range.start && date < parseFilterStart(range.start)) {
    return false;
  }

  if (range.end && date > parseFilterEnd(range.end)) {
    return false;
  }

  return true;
};

const getRangeLabel = (preset: RangePreset, range: DateRangeValue) => {
  if (preset === "today") return "Today";
  if (preset === "7d") return "Last 7 days";
  if (preset === "30d") return "Last 30 days";
  if (preset === "90d") return "Last 90 days";
  if (preset === "12m") return "Last 12 months";
  if (preset === "all") return "All time";

  if (range.start && range.end) {
    return `${shortDateTimeFormatter.format(parseFilterStart(range.start))} - ${shortDateTimeFormatter.format(parseFilterStart(range.end))}`;
  }

  if (range.start) {
    return `From ${shortDateTimeFormatter.format(parseFilterStart(range.start))}`;
  }

  if (range.end) {
    return `Until ${shortDateTimeFormatter.format(parseFilterStart(range.end))}`;
  }

  return "Custom range";
};

const RANGE_PRESETS: Array<{ key: RangePreset; label: string }> = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "90d", label: "90 Days" },
  { key: "12m", label: "12 Months" },
  { key: "all", label: "All Time" },
  { key: "custom", label: "Custom" },
];

const getStatusBadge = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized === "completed" || normalized === "paid") {
    return "bg-emerald-50 text-emerald-600 ring-emerald-500/20";
  }
  if (normalized === "shipped") {
    return "bg-sky-50 text-sky-600 ring-sky-500/20";
  }
  if (normalized === "fulfilled") {
    return "bg-violet-50 text-violet-600 ring-violet-500/20";
  }
  if (normalized === "pending") {
    return "bg-amber-50 text-amber-600 ring-amber-500/20";
  }
  if (normalized === "failed" || normalized === "cancelled") {
    return "bg-rose-50 text-rose-600 ring-rose-500/20";
  }
  return "bg-[#f2fbff] text-[#03c7fe] ring-[#03c7fe]/20";
};

/* ─── Page Component ─────────────────────────────────────────────── */

export default function OverviewPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData>({
    orders: [],
    users: [],
    products: [],
    subscriptions: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderSummary | null>(null);
  const [selectedRangePreset, setSelectedRangePreset] = useState<RangePreset>("7d");
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => getPresetDateRange("7d"));

  useEffect(() => {
    const loadDashboard = async () => {
      const token = getToken();

      if (!token) {
        router.push("/login");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [ordersRes, usersRes, productsRes, subscriptionsRes] =
          await Promise.all([
            fetch("/api/orders?type=all"),
            fetch("/api/users", { headers }),
            fetch("/api/products"),
            fetch("/api/subscriptions"),
          ]);

        if (!ordersRes.ok || !usersRes.ok || !productsRes.ok || !subscriptionsRes.ok) {
          throw new Error("Failed to load overview data.");
        }

        const [ordersPayload, usersPayload, productsPayload, subscriptionsPayload] =
          await Promise.all([
            ordersRes.json(),
            usersRes.json(),
            productsRes.json(),
            subscriptionsRes.json(),
          ]);

        setData({
          orders: Array.isArray(ordersPayload.orders) ? ordersPayload.orders : [],
          users: Array.isArray(usersPayload.users) ? usersPayload.users : [],
          products: Array.isArray(productsPayload.products) ? productsPayload.products : [],
          subscriptions: Array.isArray(subscriptionsPayload.subscriptions)
            ? subscriptionsPayload.subscriptions
            : [],
        });
      } catch (loadError) {
        console.error(loadError);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load the dashboard overview."
        );
      } finally {
        setLoading(false);
      }
    };

    void loadDashboard();
  }, [router]);

  const filteredOrders = useMemo(
    () => data.orders.filter((order) => isWithinRange(order.createdAt, dateRange)),
    [data.orders, dateRange]
  );

  const filteredUsers = useMemo(
    () => data.users.filter((user) => isWithinRange(user.createdAt, dateRange)),
    [data.users, dateRange]
  );

  const filteredProducts = useMemo(
    () => data.products.filter((product) => isWithinRange(product.createdAt, dateRange)),
    [data.products, dateRange]
  );

  const filteredSubscriptions = useMemo(
    () => data.subscriptions.filter((subscription) => isWithinRange(subscription.createdAt, dateRange)),
    [data.subscriptions, dateRange]
  );

  const overview = useMemo(() => {
    const orders = [...filteredOrders].sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    const users = [...filteredUsers].sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    const customers = users.filter((user) => user.role === "customer");
    const admins = users.filter((user) => user.role === "admin" || user.role === "superadmin");
    const subscriptions = [...filteredSubscriptions].sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    const activeSubscriptions = subscriptions.filter(
      (subscription) => (subscription.status || "").toLowerCase() === "active"
    );
    const lowStockProducts = filteredProducts.filter(
      (product) => (product.stock ?? 0) > 0 && (product.stock ?? 0) <= 5
    );
    const outOfStockProducts = filteredProducts.filter((product) => (product.stock ?? 0) <= 0);
    const paidOrders = orders.filter((order) => (order.paymentStatus || "").toLowerCase() === "paid");
    const totalRevenue = orders.reduce((sum, order) => sum + (order.total ?? 0), 0);
    const paidRevenue = paidOrders.reduce((sum, order) => sum + (order.total ?? 0), 0);
    const pendingPaymentOrders = orders.filter(
      (order) => (order.paymentStatus || "pending").toLowerCase() === "pending"
    ).length;
    const completedOrders = orders.filter(
      (order) => (order.fulfillmentStatus || "").toLowerCase() === "completed"
    ).length;

    const monthlyMap = new Map<string, { label: string; orders: number; revenue: number }>();
    const earliestOrderDate =
      orders.length > 0 ? new Date(orders[orders.length - 1].createdAt || 0) : null;
    const latestOrderDate = orders.length > 0 ? new Date(orders[0].createdAt || 0) : null;
    const today = new Date();
    const rangeStart = dateRange.start
      ? parseFilterStart(dateRange.start)
      : earliestOrderDate || startOfDay(today);
    const rangeEnd = dateRange.end
      ? parseFilterEnd(dateRange.end)
      : latestOrderDate || endOfDay(today);
    const rangeDays = Math.max(
      1,
      Math.round((endOfDay(rangeEnd).getTime() - startOfDay(rangeStart).getTime()) / 86400000) + 1
    );
    const useDailyTrend =
      selectedRangePreset === "today" ||
      selectedRangePreset === "7d" ||
      selectedRangePreset === "30d" ||
      selectedRangePreset === "90d" ||
      (selectedRangePreset === "custom" && rangeDays <= 120);

    if (useDailyTrend) {
      const cursor = startOfDay(rangeStart);
      const finalDay = startOfDay(rangeEnd);

      while (cursor <= finalDay) {
        const key = formatDateInput(cursor);
        monthlyMap.set(key, {
          label: shortDayFormatter.format(cursor),
          orders: 0,
          revenue: 0,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
    } else {
      const cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
      const finalMonth = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);

      while (cursor <= finalMonth) {
        const key = `${cursor.getFullYear()}-${cursor.getMonth()}`;
        monthlyMap.set(key, {
          label: monthYearFormatter.format(cursor),
          orders: 0,
          revenue: 0,
        });
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }

    orders.forEach((order) => {
      const createdAt = new Date(order.createdAt || 0);
      const key = useDailyTrend
        ? formatDateInput(createdAt)
        : `${createdAt.getFullYear()}-${createdAt.getMonth()}`;
      const bucket = monthlyMap.get(key);
      if (bucket) {
        bucket.orders += 1;
        bucket.revenue += order.total ?? 0;
      }
    });

    const monthlyTrend = Array.from(monthlyMap.values());

    const fulfillmentCounts = [
      { name: "Unfulfilled", value: 0 },
      { name: "Fulfilled", value: 0 },
      { name: "Shipped", value: 0 },
      { name: "Completed", value: 0 },
    ];

    orders.forEach((order) => {
      const status = (order.fulfillmentStatus || "unfulfilled").toLowerCase();
      const index = ["unfulfilled", "fulfilled", "shipped", "completed"].indexOf(status);
      if (index >= 0) {
        fulfillmentCounts[index].value += 1;
      }
    });

    const topProductsMap = new Map<
      string,
      { name: string; quantity: number; revenue: number }
    >();

    orders.forEach((order) => {
      order.items?.forEach((item) => {
        const name = item.name?.trim() || "Unnamed product";
        const existing = topProductsMap.get(name) || { name, quantity: 0, revenue: 0 };
        const quantity = item.quantity ?? 0;
        const lineTotal = item.lineTotal ?? (item.price ?? 0) * quantity;
        existing.quantity += quantity;
        existing.revenue += lineTotal;
        topProductsMap.set(name, existing);
      });
    });

    const topProducts = Array.from(topProductsMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    const recentOrders: OrderSummary[] = orders.slice(0, 6).map((order) => {
      const createdAt = new Date(order.createdAt || 0);
      return {
        id: order._id,
        customerName: getCustomerName(order.billingDetails),
        email: order.billingDetails?.email || "No email",
        phone: order.billingDetails?.phone || "No phone",
        dateLabel: shortDateTimeFormatter.format(createdAt),
        dateValue: createdAt.getTime(),
        total: order.total ?? 0,
        status: order.fulfillmentStatus || "unfulfilled",
        paymentStatus: order.paymentStatus || "pending",
        orderType: order.orderType || "normal",
        address: getCustomerAddress(order.billingDetails),
        items:
          order.items?.map((item) => ({
            name: item.name?.trim() || "Unnamed product",
            quantity: item.quantity ?? 0,
            lineTotal: item.lineTotal ?? (item.price ?? 0) * (item.quantity ?? 0),
          })) || [],
      };
    });

    const renewalWindow = activeSubscriptions.filter((subscription) => {
      if (!subscription.nextBillingDate) {
        return false;
      }

      if (!dateRange.start && !dateRange.end) {
        return true;
      }

      return isWithinRange(subscription.nextBillingDate, dateRange);
    });

    return {
      totalRevenue,
      paidRevenue,
      totalOrders: orders.length,
      pendingPaymentOrders,
      completedOrders,
      totalCustomers: customers.length,
      totalAdmins: admins.length,
      blockedUsers: users.filter((user) => user.isBlocked).length,
      activeSubscriptions: activeSubscriptions.length,
      lowStockProducts: lowStockProducts.length,
      outOfStockProducts: outOfStockProducts.length,
      filteredSubscriptions: subscriptions.length,
      filteredUsers: users.length,
      monthlyTrend,
      fulfillmentCounts,
      topProducts,
      recentOrders,
      upcomingRenewals: [...renewalWindow]
        .sort(
          (a, b) =>
            new Date(a.nextBillingDate || 0).getTime() -
            new Date(b.nextBillingDate || 0).getTime()
        )
        .slice(0, 5)
        .map((subscription) => {
          const billing = subscription.orderId?.billingDetails;
          return {
            id: subscription._id,
            subscriptionId: subscription.subscriptionId,
            customerName: getCustomerName(billing),
            email: billing?.email || "No email",
            nextBillingDate: subscription.nextBillingDate || "",
            recurrence: subscription.recurrence || "1 Month",
            totalInstallmentsPaid: subscription.totalInstallmentsPaid ?? 0,
            total: subscription.orderId?.total ?? 0,
          };
        }),
      lowStockList: [...lowStockProducts]
        .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0))
        .slice(0, 5),
      completionRate: orders.length ? Math.round((completedOrders / orders.length) * 100) : 0,
      paidOrderRate: orders.length ? Math.round((paidOrders.length / orders.length) * 100) : 0,
    };
  }, [dateRange, filteredOrders, filteredProducts, filteredSubscriptions, filteredUsers, selectedRangePreset]);

  const activeRangeLabel = useMemo(
    () => getRangeLabel(selectedRangePreset, dateRange),
    [dateRange, selectedRangePreset]
  );

  const handlePresetSelect = (preset: RangePreset) => {
    setSelectedRangePreset(preset);

    if (preset !== "custom") {
      setDateRange(getPresetDateRange(preset));
    }
  };

  /* ── Loading & Error States ── */
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f2fbff]">
        <div className="flex flex-col items-center gap-4">
          <Activity size={32} className="animate-pulse text-[#03c7fe]" />
          <h2 className="text-xs font-black uppercase tracking-widest text-[#888]">Loading Command Center...</h2>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f2fbff] px-4">
        <Panel className="max-w-lg p-8 text-center shadow-[0_30px_60px_rgba(239,68,68,0.12)]">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
            <AlertCircle size={30} />
          </div>
          <h1 className="text-2xl font-black text-[#111]">Overview unavailable</h1>
          <p className="mt-3 text-xs font-bold leading-6 text-[#888]">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-2xl bg-[#03c7fe] px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-[0_10px_25px_rgba(3,199,254,0.3)] transition hover:scale-[1.02]"
          >
            Reload Dashboard
          </button>
        </Panel>
      </main>
    );
  }

  /* ── Main Render ── */
  return (
    <main className="min-h-screen bg-[#f2fbff] px-4 py-8 md:px-8">
      
      {/* Hero Panel */}
      <Panel className="mb-6 flex flex-col gap-5 p-7 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#03c7fe] text-white shadow-[0_8px_20px_rgba(3,199,254,0.3)]">
            <LayoutDashboard size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
              Operations Command Center
            </p>
            <h1 className="text-2xl font-black text-[#111]">Dashboard Overview</h1>
            <p className="mt-1 text-xs font-bold text-[#888]">{activeRangeLabel}</p>
          </div>
        </div>
      </Panel>

      <Panel className="mb-6 p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          {RANGE_PRESETS.map((preset) => {
            const isActive = selectedRangePreset === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => handlePresetSelect(preset.key)}
                className={`rounded-2xl px-4 py-2 text-xs font-black transition hover:scale-[1.02] ${
                  isActive
                    ? "bg-[#03c7fe] text-white shadow-[0_6px_18px_rgba(3,199,254,0.3)]"
                    : "border border-[#cfeef7] bg-white text-[#555]"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <div className="rounded-2xl border border-[#cfeef7] bg-[#fbfdff] p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
                <CalendarRange size={12} /> Date Window
              </p>
              <SingleCalendarRangePicker
                value={dateRange}
                onChange={(nextRange) => {
                  setSelectedRangePreset("custom");
                  setDateRange(nextRange);
                }}
                placeholder="Pick a custom range"
                ariaLabel="Choose an overview date range"
              />
            </div>

            {(dateRange.start || dateRange.end) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedRangePreset("all");
                  setDateRange({ start: "", end: "" });
                }}
                className="rounded-2xl border border-[#cfeef7] bg-white px-4 py-2.5 text-xs font-black text-[#111] shadow-sm transition hover:scale-[1.02]"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </Panel>

      <div className="mb-6 flex flex-wrap gap-x-5 gap-y-1.5 px-1 text-xs font-black">
        <span className="text-[#03c7fe]">{activeRangeLabel}</span>
        <span className="text-[#ccc]">·</span>
        <span className="text-[#888]">
          {selectedRangePreset === "custom" ? "Custom range" : "Preset range"}
        </span>
        <span className="text-[#ccc]">·</span>
        <span className="text-[#888]">{overview.totalOrders.toLocaleString()} visible orders</span>
      </div>

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[
          {
            title: "Gross Revenue",
            value: currencyFormatter.format(overview.totalRevenue),
            hint: `${overview.totalOrders} total orders`,
            icon: <BadgeDollarSign size={18} />,
          },
          {
            title: "Paid Revenue",
            value: currencyFormatter.format(overview.paidRevenue),
            hint: `${overview.paidOrderRate}% paid completion`,
            icon: <CreditCard size={18} />,
          },
          {
            title: "Total Orders",
            value: overview.totalOrders.toLocaleString(),
            hint: `${overview.completionRate}% fulfillment rate`,
            icon: <ShoppingBag size={18} />,
          },
          {
            title: "Pending Payments",
            value: overview.pendingPaymentOrders.toLocaleString(),
            hint: "Awaiting customer action",
            icon: <CreditCard size={18} />,
          },
          {
            title: "Active Subscriptions",
            value: overview.activeSubscriptions.toLocaleString(),
            hint: `${overview.filteredSubscriptions} subscriptions in range`,
            icon: <CalendarClock size={18} />,
          },
          {
            title: "Low Stock Alerts",
            value: overview.lowStockProducts.toLocaleString(),
            hint: `${overview.outOfStockProducts} out of stock in range`,
            icon: <Boxes size={18} />,
          },
        ].map((card) => (
          <Panel key={card.title} className="flex flex-col p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#03c7fe]/10 text-[#03c7fe]">
                {card.icon}
              </span>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
              {card.title}
            </p>
            <strong className="mt-0.5 text-3xl font-black leading-tight text-[#111]">
              {card.value}
            </strong>
            <span className="mt-1.5 text-xs text-[#888]">{card.hint}</span>
          </Panel>
        ))}
      </div>

      {/* Main Charts Row */}
      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
        
        {/* Trend Chart */}
        <Panel className="p-6">
          <PanelHead 
            title="Revenue & Order Trend" 
            sub="Orders and revenue mapped across the active timeframe." 
          />
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overview.monthlyTrend} margin={{ top: 12, right: 12, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#03c7fe" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#03c7fe" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#cfeef7" strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#888", fontWeight: 800 }}
                  dy={10}
                />
                <YAxis
                  yAxisId="left"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#888", fontWeight: 800 }}
                  tickFormatter={(value) => compactNumberFormatter.format(value)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#888", fontWeight: 800 }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "16px",
                    border: "1px solid #cfeef7",
                    boxShadow: "0 10px 25px rgba(3,199,254,0.12)",
                  }}
                  itemStyle={{ fontWeight: 900, fontSize: "12px" }}
                  formatter={(value: number, name: string) =>
                    name === "Revenue"
                      ? [currencyFormatter.format(value), name]
                      : [value.toLocaleString(), name]
                  }
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="#03c7fe"
                  strokeWidth={3}
                  fill="url(#revenueFill)"
                />
                <Bar
                  yAxisId="right"
                  dataKey="orders"
                  name="Orders"
                  fill="#111"
                  radius={[8, 8, 0, 0]}
                  barSize={28}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* Fulfillment Mix */}
        <Panel className="p-6">
          <PanelHead 
            title="Fulfillment Mix" 
            sub="Order status distribution currently visible." 
          />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={overview.fulfillmentCounts}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={92}
                  paddingAngle={2}
                >
                  {overview.fulfillmentCounts.map((entry, index) => (
                    <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: "16px",
                    border: "1px solid #cfeef7",
                    boxShadow: "0 10px 25px rgba(3,199,254,0.12)",
                  }}
                  itemStyle={{ fontWeight: 900, fontSize: "12px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {overview.fulfillmentCounts.map((item, index) => (
              <div key={item.name} className="rounded-2xl border border-[#cfeef7] bg-[#fbfdff] px-4 py-3">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full shadow-sm"
                    style={{ backgroundColor: pieColors[index % pieColors.length] }}
                  />
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#111]">{item.name}</span>
                </div>
                <p className="mt-2 text-xl font-black text-[#111]">{item.value}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Secondary Data Grid */}
      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        
        {/* Best Sellers */}
        <Panel className="p-6">
          <PanelHead 
            title="Top Products Sold" 
            sub="Best performers ranked by quantity." 
            icon={<Package size={16} className="text-[#03c7fe]" />} 
          />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={overview.topProducts}
                layout="vertical"
                margin={{ top: 0, right: 12, left: 12, bottom: 0 }}
              >
                <CartesianGrid horizontal={false} stroke="#cfeef7" strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#888", fontWeight: 800 }}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={120}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#111", fontWeight: 900 }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "16px",
                    border: "1px solid #cfeef7",
                    boxShadow: "0 10px 25px rgba(3,199,254,0.12)",
                  }}
                  itemStyle={{ fontWeight: 900, fontSize: "12px" }}
                  formatter={(value: number, name: string, entry) => {
                    const payload = entry.payload as { revenue: number };
                    if (name === "quantity") {
                      return [
                        `${value.toLocaleString()} units | ${currencyFormatter.format(payload.revenue)}`,
                        "Sales",
                      ];
                    }
                    return [value, name];
                  }}
                />
                <Bar dataKey="quantity" fill="#03c7fe" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* Upcoming Renewals */}
        <Panel className="p-6">
          <div className="mb-4 flex items-start justify-between gap-2">
            <PanelHead title="Upcoming Renewals" sub="Scheduled subscription billing." />
            <button
              type="button"
              onClick={() => router.push("/dashboard/subscriptions")}
              className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#03c7fe] transition hover:text-[#111]"
            >
              View all <ArrowRight size={12} />
            </button>
          </div>
          <div className="flex flex-col gap-2.5">
            {overview.upcomingRenewals.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#cfeef7] bg-[#fbfdff] px-4 py-8 text-center text-xs font-bold text-[#888]">
                No active renewals scheduled yet.
              </div>
            ) : (
              overview.upcomingRenewals.map((renewal) => (
                <div
                  key={renewal.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[#cfeef7] bg-[#fbfdff] p-3.5 transition hover:border-[#03c7fe]/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black text-[#111]">{renewal.customerName}</p>
                    <p className="text-[10px] text-[#aaa]">
                      {shortDateTimeFormatter.format(new Date(renewal.nextBillingDate))} • {renewal.recurrence}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-black text-[#03c7fe]">
                    {currencyFormatter.format(renewal.total)}
                  </span>
                </div>
              ))
            )}
          </div>
        </Panel>

        {/* Ops Signals */}
        <Panel className="p-6">
          <PanelHead title="Ops Signals" sub="Inventory and customer watch alerts." />
          <div className="flex flex-col gap-2.5">
            
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#111] p-3.5 text-white">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/60">
                  Out of stock
                </p>
                <p className="mt-1 text-xl font-black text-white">{overview.outOfStockProducts}</p>
              </div>
              <AlertCircle className="text-rose-500" size={24} />
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-[#cfeef7] bg-[#fbfdff] p-3.5">
              <ShieldCheck size={18} className="text-[#03c7fe]" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#888]">
                  Admin coverage
                </p>
                <p className="mt-0.5 text-xs font-black text-[#111]">
                  {overview.totalAdmins} admins • {overview.blockedUsers} blocked in range
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-[#cfeef7] bg-[#fbfdff] p-3.5">
              <Users size={18} className="text-[#03c7fe]" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#888]">
                  Customer growth
                </p>
                <p className="mt-0.5 text-xs font-black text-[#111]">
                  {overview.totalCustomers} customers • {overview.filteredUsers} users in range
                </p>
              </div>
            </div>
            
          </div>
        </Panel>
      </div>

      {/* Bottom Table: Recent Orders */}
      <Panel className="p-6">
        <div className="mb-4 flex items-start justify-between gap-2">
          <PanelHead title="Recent Orders" sub="Latest commerce activity." />
          <button
            type="button"
            onClick={() => router.push("/dashboard/orders")}
            className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#03c7fe] transition hover:text-[#111]"
          >
            Open orders <ArrowRight size={12} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] border-collapse">
            <thead>
              <tr>
                <th className="border-b border-[#e0f4fb] px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Order</th>
                <th className="border-b border-[#e0f4fb] px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Customer</th>
                <th className="border-b border-[#e0f4fb] px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Date</th>
                <th className="border-b border-[#e0f4fb] px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Total</th>
                <th className="border-b border-[#e0f4fb] px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Fulfillment</th>
                <th className="border-b border-[#e0f4fb] px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Payment</th>
              </tr>
            </thead>
            <tbody>
              {overview.recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm font-bold text-[#888]">
                    No orders are available yet.
                  </td>
                </tr>
              ) : (
                overview.recentOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="cursor-pointer transition hover:bg-[#f2fbff]"
                    onClick={() => setSelectedOrder(order)}
                  >
                    <td className="border-b border-[#e0f4fb] px-4 py-4 text-sm font-black text-[#03c7fe]">
                      #{order.id.slice(-6).toUpperCase()}
                    </td>
                    <td className="border-b border-[#e0f4fb] px-4 py-4">
                      <p className="text-sm font-black text-[#111]">{order.customerName}</p>
                      <p className="mt-1 text-[10px] font-bold text-[#aaa] uppercase tracking-wider">{order.orderType}</p>
                    </td>
                    <td className="border-b border-[#e0f4fb] whitespace-nowrap px-4 py-4 text-xs font-bold text-[#888]">
                      {order.dateLabel}
                    </td>
                    <td className="border-b border-[#e0f4fb] whitespace-nowrap px-4 py-4 text-sm font-black text-[#111]">
                      {currencyFormatter.format(order.total)}
                    </td>
                    <td className="border-b border-[#e0f4fb] whitespace-nowrap px-4 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ring-1 ring-inset ${getStatusBadge(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="border-b border-[#e0f4fb] whitespace-nowrap px-4 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ring-1 ring-inset ${getStatusBadge(order.paymentStatus)}`}>
                        {order.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Slide-over Drawer for Order Details */}
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
                <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
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
                  <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ring-1 ring-inset ${getStatusBadge(selectedOrder.status)}`}>
                    {selectedOrder.status}
                  </span>
                </div>
                <div className="rounded-2xl border border-[#cfeef7] bg-[#fbfdff] px-5 py-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#888]">
                    Payment
                  </p>
                  <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ring-1 ring-inset ${getStatusBadge(selectedOrder.paymentStatus)}`}>
                    {selectedOrder.paymentStatus}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-[#cfeef7] bg-[#fbfdff] p-5">
                <h3 className="border-b border-[#e0f4fb] pb-3 text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
                  Customer details
                </h3>
                <div className="mt-4 space-y-3 text-xs font-bold text-[#555]">
                  <p><span className="font-black text-[#111]">Name:</span> {selectedOrder.customerName}</p>
                  <p><span className="font-black text-[#111]">Email:</span> {selectedOrder.email}</p>
                  <p><span className="font-black text-[#111]">Phone:</span> {selectedOrder.phone}</p>
                  <p><span className="font-black text-[#111]">Order date:</span> {selectedOrder.dateLabel}</p>
                  <p className="leading-relaxed"><span className="font-black text-[#111]">Address:</span> {selectedOrder.address}</p>
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
                      <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-black text-[#111]">{item.name}</p>
                          <p className="mt-1 text-[10px] font-bold text-[#aaa]">
                            Qty {item.quantity}
                          </p>
                        </div>
                        <p className="text-sm font-black text-[#111]">
                          {currencyFormatter.format(item.lineTotal || 0)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-[#e0f4fb] pt-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#888]">
                    Total paid
                  </span>
                  <span className="text-xl font-black text-[#03c7fe]">
                    {currencyFormatter.format(selectedOrder.total)}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t border-[#cfeef7] bg-white px-6 py-5">
              <button
                type="button"
                onClick={() => router.push("/dashboard/orders")}
                className="w-full rounded-2xl bg-[#03c7fe] py-4 text-xs font-black uppercase tracking-widest text-white shadow-[0_10px_25px_rgba(3,199,254,0.3)] transition hover:scale-[1.02]"
              >
                Open Full Orders View
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
