"use client";
import Notifications from "./components/Notifications";
import { useEffect, useState } from "react";
import { onAuthStateChanged, getIdTokenResult, signOut } from "firebase/auth";
import { collection, getDocs, query, orderBy, limit, doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import styles from "./dashboard.module.css";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function DashboardPage() {
  const router = useRouter();
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const [totalOrders, setTotalOrders] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [pending, setPending] = useState(0);
  const [delivered, setDelivered] = useState(0);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [ordersByMonth, setOrdersByMonth] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  // 🔐 Verify admin + fetch Firestore user name
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/login");
        return;
      }

      try {
        await firebaseUser.getIdToken(true);
        const token = await getIdTokenResult(firebaseUser);
        setUserEmail(firebaseUser.email);
        setIsAdmin(!!token.claims.admin);

        // ✅ Store Firebase token in cookie for middleware
        const idToken = await firebaseUser.getIdToken();
        document.cookie = `firebaseToken=${idToken}; path=/; max-age=3600; Secure; SameSite=Strict`;

        // 🔹 Fetch name from Firestore
        const userRef = doc(db, "users", firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          setUserName(data.name || null);
        } else {
          setUserName(null);
        }
      } catch {
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  // 📊 Fetch Firestore data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const ordersSnap = await getDocs(collection(db, "orders"));
        let total = 0;
        let pendingCount = 0;
        let deliveredCount = 0;
        const monthlyOrders: Record<string, number> = {};
        const productSales: Record<string, number> = {};

        ordersSnap.forEach((doc) => {
          const data = doc.data();
          total += data.total || 0;
          if (data.status === "Pending") pendingCount++;
          if (data.status === "Delivered") deliveredCount++;

          const date = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
          const month = date.toLocaleString("default", { month: "short" });
          monthlyOrders[month] = (monthlyOrders[month] || 0) + 1;

          if (Array.isArray(data.items)) {
            data.items.forEach((item: any) => {
              const name = item.name || "Unnamed";
              productSales[name] = (productSales[name] || 0) + (item.quantity || 0);
            });
          }
        });

        const ordersData = Object.entries(monthlyOrders).map(([month, count]) => ({
          month,
          orders: count,
        }));

        const productData = Object.entries(productSales)
          .map(([name, quantity]) => ({ name, quantity }))
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 5);

        setOrdersByMonth(ordersData);
        setTopProducts(productData);
        setTotalOrders(ordersSnap.size);
        setRevenue(total);
        setPending(pendingCount);
        setDelivered(deliveredCount);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      }
    };

    const fetchRecentOrders = async () => {
      try {
        const q = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(5));
        const querySnapshot = await getDocs(q);
        const orders: any[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          orders.push({
            id: doc.id,
            customer: data.customer || "Unknown",
            total: data.total || 0,
            status: data.status || "Pending",
            createdAt: data.createdAt?.toDate
              ? data.createdAt.toDate().toLocaleDateString()
              : "N/A",
            items: data.items || [],
            address: data.address || "N/A",
            email: data.email || "N/A",
            phone: data.phone || "N/A",
          });
        });
        setRecentOrders(orders);
      } catch (error) {
        console.error("Error fetching recent orders:", error);
      }
    };

    fetchDashboardData();
    fetchRecentOrders();
  }, []);

  // 🚪 Handle logout (clear token + redirect)
  const handleLogout = async () => {
    await signOut(auth);
    document.cookie = "firebaseToken=; path=/; max-age=0"; // clear cookie
    router.push("/login");
  };

  if (loading)
    return (
      <div className={styles.loadingWrapper}>
        <p>Loading...</p>
      </div>
    );

  if (isAdmin === false)
    return (
      <div className={styles.deniedWrapper}>
        <h1>Access Denied</h1>
        <button onClick={handleLogout}>Log Out</button>
      </div>
    );

  return (
    <section className={`${styles.section} space-y-6 lg:space-y-8`}>
      <div
        className={`${styles.header} flex-col gap-4 lg:flex-row lg:items-center lg:justify-between`}
      >
        <div>
          <h1 className={styles.heading}>Dashboard Overview</h1>
          <p className={styles.subtext}>Welcome back, {userName || userEmail}</p>
        </div>

        <div
          className={`${styles.headerRight} w-full flex-wrap justify-between gap-3 sm:flex-row lg:w-auto`}
        >
          <Notifications />
          <button
            onClick={handleLogout}
            className={`${styles.logoutBtn} w-full sm:w-auto`}
          >
            Log Out
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className={`${styles.cards} w-full`}>
        <div className={styles.card}><h2>Total Orders</h2><p>{totalOrders}</p></div>
        <div className={styles.card}><h2>Revenue</h2><p>LKR {revenue.toLocaleString()}</p></div>
        <div className={styles.card}><h2>Pending</h2><p>{pending}</p></div>
        <div className={styles.card}><h2>Delivered</h2><p>{delivered}</p></div>
      </div>

      {/* Table */}
      <div className={`${styles.tableWrapper} overflow-x-auto`}>
        <h2 className={styles.subHeading}>Recent Orders</h2>
        <table className={`${styles.table} min-w-[720px]`}>
          <thead>
            <tr><th>Order ID</th><th>Customer</th><th>Date</th><th>Total (LKR)</th><th>Status</th></tr>
          </thead>
          <tbody>
            {recentOrders.length === 0 ? (
              <tr><td colSpan={5} className={styles.empty}>No recent orders</td></tr>
            ) : (
              recentOrders.map((order) => (
                <tr key={order.id} onClick={() => setSelectedOrder(order)} className={styles.clickableRow}>
                  <td>{order.id}</td>
                  <td>{order.customer}</td>
                  <td>{order.createdAt}</td>
                  <td>{order.total.toLocaleString()}</td>
                  <td>
                    <span className={`${styles.status} ${styles[order.status.toLowerCase()] || ""}`}>
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Drawer */}
      {selectedOrder && (
        <div
          className={`${styles.drawerOverlay} px-4`}
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className={`${styles.drawer} w-full max-w-lg sm:max-w-xl`}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Order Details</h2>
            <p><strong>Customer:</strong> {selectedOrder.customer}</p>
            <p><strong>Email:</strong> {selectedOrder.email}</p>
            <p><strong>Phone:</strong> {selectedOrder.phone}</p>
            <p><strong>Date:</strong> {selectedOrder.createdAt}</p>
            <p><strong>Address:</strong> {selectedOrder.address}</p>
            <p><strong>Total:</strong> LKR {selectedOrder.total.toLocaleString()}</p>

            <div className={styles.itemList}>
              <h3>Items</h3>
              {Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0 ? (
                selectedOrder.items.map((item: any, i: number) => (
                  <p key={i}>
                    {item.name || "Unnamed"} × {item.quantity || 1} — LKR{" "}
                    {item.price ? item.price.toLocaleString() : 0}
                  </p>
                ))
              ) : (
                <p>No items found</p>
              )}
            </div>

            <button className={styles.closeBtn} onClick={() => setSelectedOrder(null)}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className={styles.chartContainer}>
        <div className={styles.chartCard}>
          <h2>Orders Per Month</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={ordersByMonth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="orders" fill="#2563eb" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.chartCard}>
          <h2>Top 5 Most Sold Products</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topProducts}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="quantity" fill="#16a34a" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
