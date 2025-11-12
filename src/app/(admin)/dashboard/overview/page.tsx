"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import styles from "./overview.module.css";

export default function OverviewPage() {
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [lowStock, setLowStock] = useState(0);
  const [statusData, setStatusData] = useState<any[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const ordersSnap = await getDocs(collection(db, "orders"));
        const productsSnap = await getDocs(collection(db, "products"));

        let revenue = 0;
        let statusCounts: Record<string, number> = {
          Pending: 0,
          Packed: 0,
          Shipped: 0,
          Delivered: 0,
          Cancelled: 0,
        };

        // For monthly revenue calculation
        const monthMap: Record<string, number> = {};

        ordersSnap.forEach((doc) => {
          const data = doc.data();
          const total = data.total || 0;
          const status = data.status || "Pending";
          const createdAt = data.createdAt?.toDate
            ? data.createdAt.toDate()
            : null;

          // Revenue only from delivered
          if (status === "Delivered") revenue += total;
          if (statusCounts[status] !== undefined) statusCounts[status]++;

          // Monthly revenue
          if (status === "Delivered" && createdAt) {
            const key = createdAt.toLocaleString("default", {
              month: "short",
              year: "numeric",
            });
            monthMap[key] = (monthMap[key] || 0) + total;
          }
        });

        const productList: any[] = [];
        productsSnap.forEach((doc) => {
          const data = doc.data();
          productList.push(data);
        });

        const lowStockCount = productList.filter((p) => p.stock < 5).length;

        setTotalOrders(ordersSnap.size);
        setTotalProducts(productsSnap.size);
        setTotalRevenue(revenue);
        setLowStock(lowStockCount);
        setStatusData(
          Object.keys(statusCounts).map((key) => ({
            name: key,
            value: statusCounts[key],
          }))
        );

        // Format monthly data for chart
        const sortedMonths = Object.keys(monthMap).sort(
          (a, b) => new Date(a).getTime() - new Date(b).getTime()
        );
        const monthlyData = sortedMonths.map((m) => ({
          name: m,
          revenue: monthMap[m],
        }));
        setMonthlyRevenue(monthlyData);
      } catch (error) {
        console.error("Error fetching overview data:", error);
      }
    };

    fetchData();
  }, []);

  const COLORS = ["#f59e0b", "#eab308", "#8b5cf6", "#22c55e", "#ef4444"];

  return (
    <section className={styles.section}>
      <h1 className={styles.title}>Admin Overview Dashboard</h1>

      {/* Top Summary Cards */}
      <div className={styles.cards}>
        <div className={styles.card}>
          <h3>Total Orders</h3>
          <p>{totalOrders}</p>
        </div>
        <div className={styles.card}>
          <h3>Total Products</h3>
          <p>{totalProducts}</p>
        </div>
        <div className={styles.card}>
          <h3>Total Revenue</h3>
          <p>LKR {totalRevenue.toLocaleString()}</p>
        </div>
        <div className={styles.cardWarning}>
          <h3>Low Stock</h3>
          <p>{lowStock}</p>
        </div>
      </div>

      {/* Status Summary Chart */}
      <div className={styles.statusSummary}>
        <h2>Order Status Summary</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={statusData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#2563eb" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Charts Section */}
      <div className={styles.charts}>
        <div className={styles.chartBox}>
          <h2>Order Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.chartBox}>
          <h2>Monthly Revenue Growth</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
