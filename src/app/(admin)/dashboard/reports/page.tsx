"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import jsPDF from "jspdf";
import Papa from "papaparse";
import {
  ArrowUpRight,
  CalendarRange,
  Download,
  FileText,
  MapPinned,
  Package,
  RefreshCw,
  Repeat2,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  DateRangeValue,
  SingleCalendarRangePicker,
} from "@/app/(admin)/dashboard/components/SingleCalendarRangePicker";
import PageLoader from "@/app/(admin)/dashboard/components/PageLoader";

/* ─── Types ──────────────────────────────────────────────────────── */

type OrderItem = {
  name: string;
  quantity: number;
  price: number;
  lineTotal?: number;
};

type BillingDetails = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  street: string;
};

type Order = {
  _id: string;
  total: number;
  subtotal?: number;
  shippingCost?: number;
  orderType?: "normal" | "subscription";
  paymentStatus?: "pending" | "paid" | "failed" | "refunded";
  fulfillmentStatus?: "unfulfilled" | "fulfilled" | "shipped" | "completed";
  createdAt: string;
  items: OrderItem[];
  billingDetails: BillingDetails;
};

type RangePreset = "today" | "week" | "month" | "quarter" | "year" | "all" | "custom";
type OrderTypeFilter = "all" | "normal" | "subscription";

type MetricCard = {
  title: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  delta?: number | null;
};

/* ─── Constants ──────────────────────────────────────────────────── */

const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "7 Days" },
  { value: "month", label: "30 Days" },
  { value: "quarter", label: "90 Days" },
  { value: "year", label: "12 Months" },
  { value: "all", label: "All Time" },
  { value: "custom", label: "Custom" },
];

const PIE_COLORS = ["#03c7fe", "#0ea5e9", "#38bdf8", "#7dd3fc", "#bae6fd"];

const compactNumberFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/* ─── Helpers ────────────────────────────────────────────────────── */

function formatCurrency(value: number) {
  return `LKR ${Math.round(value).toLocaleString()}`;
}

function formatPercent(value: number) {
  return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(date: Date, amount: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + amount);
  return next;
}

function getRangeBounds(
  preset: RangePreset,
  customRange: DateRangeValue
): { start: Date | null; end: Date | null } {
  const now = new Date();
  if (preset === "all") return { start: null, end: null };
  if (preset === "custom") {
    return {
      start: customRange.start ? startOfDay(new Date(`${customRange.start}T00:00:00`)) : null,
      end: customRange.end ? endOfDay(new Date(`${customRange.end}T00:00:00`)) : null,
    };
  }
  if (preset === "today") return { start: startOfDay(now), end: endOfDay(now) };
  if (preset === "week") return { start: startOfDay(addDays(now, -6)), end: endOfDay(now) };
  if (preset === "month") return { start: startOfDay(addDays(now, -29)), end: endOfDay(now) };
  if (preset === "quarter") return { start: startOfDay(addDays(now, -89)), end: endOfDay(now) };
  return { start: startOfDay(addMonths(now, -11)), end: endOfDay(now) };
}

function computePreviousBounds(
  start: Date | null,
  end: Date | null
): { start: Date | null; end: Date | null } {
  if (!start || !end) return { start: null, end: null };
  const duration = end.getTime() - start.getTime();
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - duration);
  return { start: previousStart, end: previousEnd };
}

function calcDelta(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

function formatOrderId(id: string) {
  return `#${id.slice(-6).toUpperCase()}`;
}

function formatDateLabel(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateInputValue(date: Date | null) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildTimelineData(orders: Order[], start: Date | null, end: Date | null) {
  if (!orders.length) return [];
  const useMonthly =
    start && end ? end.getTime() - start.getTime() > 1000 * 60 * 60 * 24 * 75 : true;

  const buckets = new Map<
    string,
    { label: string; revenue: number; orders: number; units: number; sortKey: number }
  >();

  orders.forEach((order) => {
    const date = new Date(order.createdAt);
    const key = useMonthly
      ? `${date.getFullYear()}-${date.getMonth()}`
      : `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const label = useMonthly
      ? date.toLocaleDateString(undefined, { month: "short", year: "2-digit" })
      : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const e = buckets.get(key) || { label, revenue: 0, orders: 0, units: 0, sortKey: date.getTime() };
    e.revenue += order.total || 0;
    e.orders += 1;
    e.units += order.items.reduce((s, i) => s + (i.quantity || 0), 0);
    e.sortKey = Math.min(e.sortKey, date.getTime());
    buckets.set(key, e);
  });

  return Array.from(buckets.values())
    .sort((l, r) => l.sortKey - r.sortKey)
    .map(({ label, revenue, orders: orderCount, units }) => ({ label, revenue, orders: orderCount, units }));
}

/* ─── Shared Panel shell ─────────────────────────────────────────── */

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
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

/* ─── Page ───────────────────────────────────────────────────────── */

export default function ReportsPage() {
  const API = process.env.NEXT_PUBLIC_API_URL || "";

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [rangePreset, setRangePreset] = useState<RangePreset>("today");
  const [customRange, setCustomRange] = useState<DateRangeValue>({ start: "", end: "" });
  const [orderTypeFilter, setOrderTypeFilter] = useState<OrderTypeFilter>("all");

  const fetchOrders = useCallback(
    async (manual = false) => {
      if (manual) setRefreshing(true);
      else setLoading(true);
      try {
        setError("");
        const response = await fetch(`${API}/api/orders?type=all`);
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Failed to fetch reports data.");
        setOrders(Array.isArray(data) ? data : data.orders || []);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "Failed to fetch reports data.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [API]
  );

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const { currentBounds, previousBounds } = useMemo(() => {
    const current = getRangeBounds(rangePreset, customRange);
    return { currentBounds: current, previousBounds: computePreviousBounds(current.start, current.end) };
  }, [customRange, rangePreset]);

  const calendarRangeValue = useMemo<DateRangeValue>(() => {
    if (rangePreset === "custom") return customRange;

    return {
      start: formatDateInputValue(currentBounds.start),
      end: formatDateInputValue(currentBounds.end),
    };
  }, [currentBounds.end, currentBounds.start, customRange, rangePreset]);

  const filteredOrders = useMemo(() =>
    orders.filter((order) => {
      if (orderTypeFilter !== "all" && (order.orderType || "normal") !== orderTypeFilter) return false;
      const d = new Date(order.createdAt);
      if (currentBounds.start && d < currentBounds.start) return false;
      if (currentBounds.end && d > currentBounds.end) return false;
      return true;
    }), [currentBounds, orderTypeFilter, orders]);

  const previousOrders = useMemo(() =>
    orders.filter((order) => {
      if (orderTypeFilter !== "all" && (order.orderType || "normal") !== orderTypeFilter) return false;
      const d = new Date(order.createdAt);
      if (previousBounds.start && d < previousBounds.start) return false;
      if (previousBounds.end && d > previousBounds.end) return false;
      return true;
    }), [orderTypeFilter, orders, previousBounds]);

  const summary = useMemo(() => {
    const totalRevenue = filteredOrders.reduce((s, o) => s + (o.total || 0), 0);
    const totalOrders = filteredOrders.length;
    const totalUnits = filteredOrders.reduce((s, o) => s + o.items.reduce((ss, i) => ss + (i.quantity || 0), 0), 0);
    const subscriptionOrders = filteredOrders.filter((o) => (o.orderType || "normal") === "subscription").length;
    const completedOrders = filteredOrders.filter((o) => o.fulfillmentStatus === "completed").length;
    const paidOrders = filteredOrders.filter((o) => o.paymentStatus === "paid").length;
    const avgOrderValue = totalOrders ? totalRevenue / totalOrders : 0;
    const previousRevenue = previousOrders.reduce((s, o) => s + (o.total || 0), 0);
    const previousUnits = previousOrders.reduce((s, o) => s + o.items.reduce((ss, i) => ss + (i.quantity || 0), 0), 0);
    return {
      totalRevenue, totalOrders, totalUnits, subscriptionOrders, completedOrders, paidOrders, avgOrderValue,
      completionRate: totalOrders ? (completedOrders / totalOrders) * 100 : 0,
      paidRate: totalOrders ? (paidOrders / totalOrders) * 100 : 0,
      subscriptionShare: totalOrders ? (subscriptionOrders / totalOrders) * 100 : 0,
      revenueDelta: calcDelta(totalRevenue, previousRevenue),
      orderDelta: calcDelta(totalOrders, previousOrders.length),
      unitDelta: calcDelta(totalUnits, previousUnits),
      aovDelta: calcDelta(avgOrderValue, previousOrders.length ? previousRevenue / previousOrders.length : 0),
    };
  }, [filteredOrders, previousOrders]);

  const timelineData = useMemo(
    () => buildTimelineData(filteredOrders, currentBounds.start, currentBounds.end),
    [currentBounds, filteredOrders]
  );

  const fulfillmentData = useMemo(() => {
    const map = new Map<string, number>();
    filteredOrders.forEach((o) => { const k = o.fulfillmentStatus || "unfulfilled"; map.set(k, (map.get(k) || 0) + 1); });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredOrders]);

  const paymentData = useMemo(() => {
    const map = new Map<string, number>();
    filteredOrders.forEach((o) => { const k = o.paymentStatus || "pending"; map.set(k, (map.get(k) || 0) + 1); });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredOrders]);

  const orderTypeData = useMemo(() => {
    const normalCount = filteredOrders.filter((o) => (o.orderType || "normal") === "normal").length;
    return [
      { name: "Normal", value: normalCount },
      { name: "Subscription", value: filteredOrders.length - normalCount },
    ].filter((e) => e.value > 0);
  }, [filteredOrders]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; units: number; orders: number }>();
    filteredOrders.forEach((order) => {
      order.items.forEach((item) => {
        const name = item.name || "Unnamed product";
        const e = map.get(name) || { name, revenue: 0, units: 0, orders: 0 };
        e.revenue += item.lineTotal || item.price * item.quantity || 0;
        e.units += item.quantity || 0;
        e.orders += 1;
        map.set(name, e);
      });
    });
    return Array.from(map.values()).sort((l, r) => r.revenue - l.revenue).slice(0, 6);
  }, [filteredOrders]);

  const topCities = useMemo(() => {
    const map = new Map<string, { city: string; revenue: number; orders: number }>();
    filteredOrders.forEach((order) => {
      const city = order.billingDetails?.city?.trim() || "Unknown";
      const e = map.get(city) || { city, revenue: 0, orders: 0 };
      e.revenue += order.total || 0;
      e.orders += 1;
      map.set(city, e);
    });
    return Array.from(map.values()).sort((l, r) => r.revenue - l.revenue).slice(0, 6);
  }, [filteredOrders]);

  const featuredOrders = useMemo(
    () => [...filteredOrders].sort((l, r) => r.total - l.total).slice(0, 6),
    [filteredOrders]
  );

  const insightNotes = useMemo(() => {
    const notes: string[] = [];
    if (topProducts[0]) notes.push(`${topProducts[0].name} leads this window with ${formatCurrency(topProducts[0].revenue)} in revenue.`);
    if (topCities[0]) notes.push(`${topCities[0].city} is the strongest market with ${topCities[0].orders} orders.`);
    notes.push(`${formatPercent(summary.completionRate)} of filtered orders are completed and ${formatPercent(summary.paidRate)} are paid.`);
    if (summary.subscriptionShare > 0) notes.push(`Subscriptions account for ${formatPercent(summary.subscriptionShare)} of current orders.`);
    return notes.slice(0, 4);
  }, [summary, topCities, topProducts]);

  const metricCards: MetricCard[] = useMemo(() => [
    { title: "Revenue", value: formatCurrency(summary.totalRevenue), hint: `${filteredOrders.length} orders in range`, icon: <Wallet size={18} />, delta: summary.revenueDelta },
    { title: "Average Order", value: formatCurrency(summary.avgOrderValue), hint: `${summary.totalUnits} units sold`, icon: <TrendingUp size={18} />, delta: summary.aovDelta },
    { title: "Order Volume", value: summary.totalOrders.toLocaleString(), hint: `${formatPercent(summary.completionRate)} completed`, icon: <ShoppingCart size={18} />, delta: summary.orderDelta },
    { title: "Subscription Mix", value: formatPercent(summary.subscriptionShare), hint: `${summary.subscriptionOrders} recurring orders`, icon: <Repeat2 size={18} /> },
    { title: "Paid Orders", value: formatPercent(summary.paidRate), hint: `${summary.paidOrders} paid transactions`, icon: <ArrowUpRight size={18} /> },
    { title: "Units Sold", value: summary.totalUnits.toLocaleString(), hint: topProducts[0]?.name || "No product leaders yet", icon: <Package size={18} />, delta: summary.unitDelta },
  ], [filteredOrders.length, summary, topProducts]);

  const activeRangeLabel = useMemo(() => {
    if (rangePreset !== "custom") return RANGE_PRESETS.find((p) => p.value === rangePreset)?.label || "Range";
    if (customRange.start && customRange.end) return `${formatDateLabel(customRange.start)} – ${formatDateLabel(customRange.end)}`;
    if (customRange.start) return `${formatDateLabel(customRange.start)} onward`;
    return "Custom range";
  }, [customRange, rangePreset]);

  const handleExportPdf = () => {
    const doc = new jsPDF();
    const lines = [
      `Report Range: ${activeRangeLabel}`, `Order Type: ${orderTypeFilter}`,
      `Revenue: ${formatCurrency(summary.totalRevenue)}`, `Orders: ${summary.totalOrders}`,
      `Average Order Value: ${formatCurrency(summary.avgOrderValue)}`, `Units Sold: ${summary.totalUnits}`,
      `Paid Rate: ${formatPercent(summary.paidRate)}`, `Completion Rate: ${formatPercent(summary.completionRate)}`,
      "", "Top Products",
      ...topProducts.map((p, i) => `${i + 1}. ${p.name} | ${formatCurrency(p.revenue)} | ${p.units} units`),
      "", "Top Cities",
      ...topCities.map((c, i) => `${i + 1}. ${c.city} | ${formatCurrency(c.revenue)} | ${c.orders} orders`),
    ];
    doc.setFontSize(18);
    doc.text("Supplement Store Admin Report", 14, 20);
    doc.setFontSize(11);
    let y = 34;
    lines.forEach((line) => { if (y > 280) { doc.addPage(); y = 20; } doc.text(line, 14, y); y += 8; });
    doc.save(`reports-${rangePreset}-${Date.now()}.pdf`);
  };

  const handleExportCsv = () => {
    const csv = Papa.unparse(filteredOrders.map((o) => ({
      orderId: o._id, createdAt: o.createdAt,
      customer: `${o.billingDetails?.firstName || ""} ${o.billingDetails?.lastName || ""}`.trim(),
      email: o.billingDetails?.email || "", city: o.billingDetails?.city || "",
      orderType: o.orderType || "normal", paymentStatus: o.paymentStatus || "pending",
      fulfillmentStatus: o.fulfillmentStatus || "unfulfilled",
      items: o.items.map((i) => `${i.name} x${i.quantity}`).join(" | "), total: o.total || 0,
    })));
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reports-${rangePreset}-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  /* ── Loading state ── */
  if (loading) {
    return <PageLoader icon={FileText} label="Loading Reports..." />;
  }

  /* ── Main render ── */
  return (
    <main className="min-h-screen bg-[#f2fbff] px-4 py-8 md:px-8">

      {/* Hero */}
      <Panel className="mb-6 flex flex-col gap-5 p-7 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#03c7fe] text-white shadow-[0_8px_20px_rgba(3,199,254,0.3)]">
            <FileText size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
              Reports Command Center
            </p>
            <h1 className="text-2xl font-black text-[#111]">Reports &amp; Analytics</h1>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => fetchOrders(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-2xl border border-[#cfeef7] bg-white px-4 py-2.5 text-xs font-black text-[#111] shadow-sm transition hover:scale-[1.02] disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 rounded-2xl border border-[#cfeef7] bg-white px-4 py-2.5 text-xs font-black text-[#111] shadow-sm transition hover:scale-[1.02]"
          >
            <Download size={14} />
            Export CSV
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#03c7fe] px-5 py-2.5 text-xs font-black text-white shadow-[0_10px_25px_rgba(3,199,254,0.3)] transition hover:scale-[1.02]"
          >
            <FileText size={14} />
            Export PDF
          </button>
        </div>
      </Panel>

      {/* Toolbar */}
      <Panel className="mb-6 p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          {RANGE_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => setRangePreset(preset.value)}
              className={`rounded-2xl px-4 py-2 text-xs font-black transition hover:scale-[1.02] ${
                preset.value === rangePreset
                  ? "bg-[#03c7fe] text-white shadow-[0_6px_18px_rgba(3,199,254,0.3)]"
                  : "border border-[#cfeef7] bg-white text-[#555]"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_0.8fr]">
          <div className="rounded-2xl border border-[#cfeef7] bg-[#fbfdff] p-4">
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
              <CalendarRange size={12} /> Date Window
            </p>
            <SingleCalendarRangePicker
              value={calendarRangeValue}
              onChange={(nextRange) => { setCustomRange(nextRange); setRangePreset("custom"); }}
              placeholder="Pick a custom range"
              ariaLabel="Choose a custom date range"
            />
          </div>

          <div className="rounded-2xl border border-[#cfeef7] bg-[#fbfdff] p-4">
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
              Order Type
            </p>
            <select
              value={orderTypeFilter}
              onChange={(e) => setOrderTypeFilter(e.target.value as OrderTypeFilter)}
              className="w-full rounded-xl border border-[#cfeef7] bg-[#fbfdff] p-3 text-sm font-bold text-[#111] outline-none transition focus:border-[#03c7fe] focus:ring-2 focus:ring-[#03c7fe]/20"
            >
              <option value="all">All orders</option>
              <option value="normal">Normal orders</option>
              <option value="subscription">Subscription orders</option>
            </select>
          </div>
        </div>
      </Panel>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {/* Context strip */}
      <div className="mb-6 flex flex-wrap gap-x-5 gap-y-1.5 px-1 text-xs font-black">
        <span className="text-[#03c7fe]">{activeRangeLabel}</span>
        <span className="text-[#ccc]">·</span>
        <span className="text-[#888]">{orderTypeFilter === "all" ? "All order types" : `${orderTypeFilter} only`}</span>
        <span className="text-[#ccc]">·</span>
        <span className="text-[#888]">{filteredOrders.length.toLocaleString()} visible orders</span>
      </div>

      {/* Metric cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metricCards.map((card) => (
          <Panel key={card.title} className="flex flex-col p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#03c7fe]/10 text-[#03c7fe]">
                {card.icon}
              </span>
              {typeof card.delta === "number" && (
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                    card.delta >= 0
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {card.delta >= 0 ? "+" : ""}
                  {card.delta.toFixed(1)}%
                </span>
              )}
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

      {/* Main charts */}
      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">

        {/* Timeline */}
        <Panel className="p-6">
          <PanelHead title="Revenue & Order Flow" sub="Track how orders and revenue moved across the selected window." />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timelineData}>
                <CartesianGrid stroke="#e0f4fb" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke="#aaa" tick={{ fontSize: 11 }} />
                <YAxis
                  yAxisId="left"
                  stroke="#aaa"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => compactNumberFormatter.format(value)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#aaa"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => compactNumberFormatter.format(value)}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 16, border: "1px solid #cfeef7", fontSize: 12, boxShadow: "0 8px 24px rgba(3,199,254,0.12)" }}
                  formatter={(value: number, name: string) => name === "Revenue" ? formatCurrency(value) : value.toLocaleString()}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="left" dataKey="orders" name="Orders" fill="#bae6fd" radius={[8, 8, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="revenue" name="Revenue" stroke="#03c7fe" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* Fulfillment */}
        <Panel className="p-6">
          <PanelHead title="Fulfillment Mix" sub="Operational status across the current filtered order set." />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fulfillmentData}>
                <CartesianGrid stroke="#e0f4fb" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="#aaa" tick={{ fontSize: 11 }} />
                <YAxis stroke="#aaa" allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 16,
                    border: "1px solid #cfeef7",
                    fontSize: 12,
                    boxShadow: "0 8px 24px rgba(3,199,254,0.12)",
                  }}
                />
                <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                  {fulfillmentData.map((_, index) => (
                    <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* Order Type Pie */}
        <Panel className="p-6">
          <PanelHead title="Order Type Split" sub="Normal versus subscription activity in the selected range." />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={orderTypeData} dataKey="value" nameKey="name" innerRadius={68} outerRadius={106} paddingAngle={3}>
                  {orderTypeData.map((entry, index) => (
                    <Cell key={`${entry.name}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 16,
                    border: "1px solid #cfeef7",
                    fontSize: 12,
                    boxShadow: "0 8px 24px rgba(3,199,254,0.12)",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* Payment Health */}
        <Panel className="p-6">
          <PanelHead title="Payment Health" sub="Transaction outcomes currently visible in the report view." />
          <div className="flex flex-col gap-4 pt-2">
            {paymentData.length ? (
              paymentData.map((entry, index) => {
                const pct = filteredOrders.length ? (entry.value / filteredOrders.length) * 100 : 0;
                return (
                  <div key={entry.name}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-xs font-black capitalize text-[#555]">{entry.name}</span>
                      <span className="text-xs font-black text-[#111]">
                        {entry.value} <span className="font-bold text-[#aaa]">({formatPercent(pct)})</span>
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#e0f4fb]">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-center text-sm text-[#aaa]">No payment data for this range.</p>
            )}
          </div>
        </Panel>
      </div>

      {/* Secondary grid */}
      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">

        {/* Top Products */}
        <Panel className="p-6">
          <PanelHead title="Top Products" sub="Best performers ranked by revenue." icon={<Package size={16} className="text-[#03c7fe]" />} />
          <div className="flex flex-col gap-2.5">
            {topProducts.length ? topProducts.map((product, index) => (
              <div key={product.name} className="flex items-center justify-between gap-3 rounded-2xl border border-[#cfeef7] bg-[#fbfdff] p-3.5 transition hover:border-[#03c7fe]/40">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#03c7fe]/10 text-xs font-black text-[#03c7fe]">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black text-[#111]">{product.name}</p>
                    <p className="text-[10px] text-[#aaa]">{product.units} units · {product.orders} lines</p>
                  </div>
                </div>
                <span className="shrink-0 text-xs font-black text-[#111]">{formatCurrency(product.revenue)}</span>
              </div>
            )) : <p className="text-center text-sm text-[#aaa]">No product performance data available.</p>}
          </div>
        </Panel>

        {/* Top Cities */}
        <Panel className="p-6">
          <PanelHead title="Top Cities" sub="Where the filtered revenue is concentrated." icon={<MapPinned size={16} className="text-[#03c7fe]" />} />
          <div className="flex flex-col gap-2.5">
            {topCities.length ? topCities.map((city, index) => (
              <div key={city.city} className="flex items-center justify-between gap-3 rounded-2xl border border-[#cfeef7] bg-[#fbfdff] p-3.5 transition hover:border-[#03c7fe]/40">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#03c7fe]/10 text-xs font-black text-[#03c7fe]">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-xs font-black text-[#111]">{city.city}</p>
                    <p className="text-[10px] text-[#aaa]">{city.orders} orders</p>
                  </div>
                </div>
                <span className="shrink-0 text-xs font-black text-[#111]">{formatCurrency(city.revenue)}</span>
              </div>
            )) : <p className="text-center text-sm text-[#aaa]">No city breakdown available.</p>}
          </div>
        </Panel>

        {/* Report Notes */}
        <Panel className="p-6">
          <PanelHead title="Report Notes" sub="Quick readouts from the current filtered dataset." />
          <div className="flex flex-col gap-2.5">
            {insightNotes.map((note) => (
              <div key={note} className="rounded-2xl border border-[#cfeef7] bg-[#fbfdff] p-3.5 text-xs leading-relaxed text-[#444]">
                {note}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Highest Value Orders table */}
      <Panel className="p-6">
        <PanelHead title="Highest Value Orders" sub="Large baskets and key customer orders in the current report window." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] border-collapse">
            <thead>
              <tr>
                {["Order", "Customer", "Placed", "Type", "Payment", "Fulfillment", "Total"].map((col) => (
                  <th key={col} className="border-b border-[#e0f4fb] px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {featuredOrders.length ? (
                featuredOrders.map((order) => (
                  <tr key={order._id} className="transition hover:bg-[#f2fbff]">
                    <td className="border-b border-[#e0f4fb] px-4 py-3 text-sm font-black text-[#111]">
                      {formatOrderId(order._id)}
                    </td>
                    <td className="border-b border-[#e0f4fb] px-4 py-3">
                      <p className="text-sm font-black text-[#111]">
                        {order.billingDetails?.firstName} {order.billingDetails?.lastName}
                      </p>
                      <p className="text-[11px] text-[#aaa]">{order.billingDetails?.city || "Unknown city"}</p>
                    </td>
                    <td className="border-b border-[#e0f4fb] px-4 py-3 text-sm text-[#555]">
                      {formatDateLabel(order.createdAt)}
                    </td>
                    <td className="border-b border-[#e0f4fb] px-4 py-3 text-sm capitalize text-[#555]">
                      {order.orderType || "normal"}
                    </td>
                    <td className="border-b border-[#e0f4fb] px-4 py-3 text-sm capitalize text-[#555]">
                      {order.paymentStatus || "pending"}
                    </td>
                    <td className="border-b border-[#e0f4fb] px-4 py-3 text-sm capitalize text-[#555]">
                      {order.fulfillmentStatus || "unfulfilled"}
                    </td>
                    <td className="border-b border-[#e0f4fb] px-4 py-3 text-sm font-black text-[#111]">
                      {formatCurrency(order.total || 0)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-[#aaa]">
                    No orders found for the current report filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

    </main>
  );
}
