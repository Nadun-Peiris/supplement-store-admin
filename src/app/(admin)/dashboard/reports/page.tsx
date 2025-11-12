"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import styles from "./reports.module.css";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import jsPDF from "jspdf";

export default function ReportsPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState("month");

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "orders"));
        const list: any[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          list.push({
            id: doc.id,
            total: data.total || 0,
            date: data.createdAt?.toDate
              ? data.createdAt.toDate()
              : new Date(),
            items: Array.isArray(data.items) ? data.items : [],
          });
        });

        setOrders(list);
        setFilteredOrders(list);
      } catch (error) {
        console.error("Error fetching orders:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  // 🔹 Filter by date range
  useEffect(() => {
    const now = new Date();
    let filtered = orders;

    if (dateFilter === "today") {
      filtered = orders.filter((o) => {
        const d = o.date;
        return (
          d.getDate() === now.getDate() &&
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      });
    } else if (dateFilter === "week") {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 7);
      filtered = orders.filter((o) => o.date >= startOfWeek && o.date <= now);
    } else if (dateFilter === "month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      filtered = orders.filter((o) => o.date >= startOfMonth && o.date <= now);
    }

    setFilteredOrders(filtered);
  }, [dateFilter, orders]);

  // 🔹 Calculate Totals
  const totalRevenue = filteredOrders.reduce((acc, o) => acc + o.total, 0);
  const totalOrders = filteredOrders.length;
  const avgOrderValue = totalOrders ? totalRevenue / totalOrders : 0;

  // 🔹 Daily Revenue Trend
  const dailyData = Object.values(
    filteredOrders.reduce((acc: any, order) => {
      const day = order.date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      acc[day] = acc[day] || { day, revenue: 0 };
      acc[day].revenue += order.total;
      return acc;
    }, {})
  );

  // 🔹 Top 5 Products
  const productSales: Record<string, number> = {};
  filteredOrders.forEach((o) => {
    if (Array.isArray(o.items)) {
      o.items.forEach((i: any) => {
        if (i?.name && typeof i.price === "number" && typeof i.quantity === "number") {
          productSales[i.name] =
            (productSales[i.name] || 0) + i.price * i.quantity;
        }
      });
    }
  });

  const topProducts = Object.entries(productSales)
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // 🔹 PDF Export
  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Supplement Store - Reports & Analytics", 14, 20);

    doc.setFontSize(12);
    doc.text(`Date Range: ${dateFilter.toUpperCase()}`, 14, 35);
    doc.text(`Total Revenue: LKR ${totalRevenue.toLocaleString()}`, 14, 45);
    doc.text(`Total Orders: ${totalOrders}`, 14, 55);
    doc.text(`Average Order Value: LKR ${avgOrderValue.toFixed(2)}`, 14, 65);

    doc.text("Top Products:", 14, 80);
    topProducts.forEach((p, i) => {
      doc.text(`${i + 1}. ${p.name} - LKR ${p.revenue.toLocaleString()}`, 20, 90 + i * 10);
    });

    doc.save(`reports-${dateFilter}.pdf`);
  };

  if (loading) return <p className={styles.loading}>Loading analytics...</p>;

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h1 className={styles.heading}>Reports & Analytics</h1>

        <div className={styles.actions}>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className={styles.filter}
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="all">All Time</option>
          </select>

          <button onClick={handleDownloadPDF} className={styles.downloadBtn}>
            Download PDF
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className={styles.cards}>
        <div className={styles.card}>
          <h2>Total Revenue</h2>
          <p>LKR {totalRevenue.toLocaleString()}</p>
        </div>
        <div className={styles.card}>
          <h2>Total Orders</h2>
          <p>{totalOrders}</p>
        </div>
        <div className={styles.card}>
          <h2>Average Order Value</h2>
          <p>LKR {avgOrderValue.toFixed(2)}</p>
        </div>
      </div>

      {/* Charts */}
      <div className={styles.charts}>
        <div className={styles.chartBox}>
          <h3>Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" stroke="#000" />
              <YAxis stroke="#000" />
              <Tooltip />
              <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.chartBox}>
          <h3>Top 5 Selling Products</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topProducts}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" stroke="#000" />
              <YAxis stroke="#000" />
              <Tooltip />
              <Bar dataKey="revenue" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
