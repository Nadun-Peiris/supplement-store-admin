"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import styles from "./orders.module.css";

interface Order {
  id: string;
  customer: string;
  email: string;
  phone: string;
  total: number;
  status: string;
  createdAt: string;
  items?: { name: string; quantity: number; price: number }[];
  address?: string;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [newStatus, setNewStatus] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // ✅ Toast state (message + type)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | null }>({
    message: "",
    type: null,
  });

  // 🔹 Fetch orders from Firestore
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "orders"));
        const list: Order[] = [];

        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            customer: data.customer || "Unknown",
            email: data.email || "N/A",
            phone: data.phone || "N/A",
            total: data.total || 0,
            status: data.status || "Pending",
            createdAt: data.createdAt?.toDate
              ? data.createdAt.toDate().toLocaleDateString()
              : "N/A",
            items: Array.isArray(data.items) ? data.items : [],
            address: data.address || "N/A",
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

  // 🔹 Handle filters and search
  useEffect(() => {
    let result = orders;

    if (filterStatus !== "All") {
      result = result.filter((order) => order.status === filterStatus);
    }

    if (searchTerm.trim() !== "") {
      result = result.filter((order) =>
        order.customer.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredOrders(result);
  }, [searchTerm, filterStatus, orders]);

  // 🔹 Update Firestore order status
  const handleUpdateStatus = async () => {
    if (!selectedOrder || !newStatus || newStatus === selectedOrder.status)
      return;

    setUpdating(true);
    try {
      const orderRef = doc(db, "orders", selectedOrder.id);
      await updateDoc(orderRef, {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      setOrders((prev) =>
        prev.map((o) =>
          o.id === selectedOrder.id ? { ...o, status: newStatus } : o
        )
      );

      setSelectedOrder({ ...selectedOrder, status: newStatus });

      // ✅ Success toast
      showToast("Order status updated successfully ✅", "success");
    } catch (error) {
      console.error("Error updating status:", error);

      // ❌ Error toast
      showToast("Failed to update order status ❌", "error");
    } finally {
      setUpdating(false);
    }
  };

  // ✅ Show toast with message + type
  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: "", type: null }), 2500);
  };

  const openDrawer = (order: Order) => {
    setSelectedOrder(order);
    setNewStatus(order.status);
  };

  const closeDrawer = () => {
    setSelectedOrder(null);
    setNewStatus("");
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <p>Loading orders...</p>
      </div>
    );
  }

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h1 className={styles.heading}>Orders</h1>
        <div className={styles.controls}>
          <input
            type="text"
            placeholder="Search by customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.search}
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={styles.select}
          >
            <option value="All">All</option>
            <option value="Pending">Pending</option>
            <option value="Packed">Packed</option>
            <option value="Shipped">Shipped</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Phone</th>
              <th>Date</th>
              <th>Total (LKR)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.empty}>
                  No orders found
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => openDrawer(order)}
                  className={styles.row}
                >
                  <td>{order.id}</td>
                  <td>{order.customer}</td>
                  <td>{order.phone}</td>
                  <td>{order.createdAt}</td>
                  <td>{order.total.toLocaleString()}</td>
                  <td>
                    <span
                      className={`${styles.status} ${
                        styles[order.status.toLowerCase()] || ""
                      }`}
                    >
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
        <div className={styles.drawerOverlay} onClick={closeDrawer}>
          <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <button className={styles.closeIcon} onClick={closeDrawer}>
              ✕
            </button>

            <h2>Order Details</h2>
            <p>
              <strong>Customer:</strong> {selectedOrder.customer}
            </p>
            <p>
              <strong>Email:</strong> {selectedOrder.email}
            </p>
            <p>
              <strong>Phone:</strong> {selectedOrder.phone}
            </p>
            <p>
              <strong>Date:</strong> {selectedOrder.createdAt}
            </p>
            <p>
              <strong>Address:</strong> {selectedOrder.address}
            </p>
            <p>
              <strong>Total:</strong> LKR{" "}
              {selectedOrder.total.toLocaleString()}
            </p>

            <div className={styles.itemList}>
              <h3>Items</h3>
              {Array.isArray(selectedOrder.items) &&
              selectedOrder.items.length > 0 ? (
                <ul>
                  {selectedOrder.items.map((item, i) => (
                    <li key={i}>
                      {item.name || "Unnamed Item"} × {item.quantity || 1} – LKR{" "}
                      {item.price ? item.price.toLocaleString() : 0}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No items found</p>
              )}
            </div>

            <div className={styles.statusUpdate}>
              <label htmlFor="status">Update Status:</label>
              <select
                id="status"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                disabled={updating}
                className={`${styles.selectDropdown} ${
                  styles[newStatus.toLowerCase()] || ""
                }`}
              >
                <option value="Pending">Pending</option>
                <option value="Packed">Packed</option>
                <option value="Shipped">Shipped</option>
                <option value="Delivered">Delivered</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <button
              className={styles.updateBtn}
              onClick={handleUpdateStatus}
              disabled={updating}
            >
              {updating ? "Updating..." : "Update"}
            </button>
          </div>
        </div>
      )}

      {/* ✅ Toast Notification */}
      {toast.type && (
        <div
          className={`${styles.toast} ${
            toast.type === "success" ? styles.successToast : styles.errorToast
          }`}
        >
          {toast.message}
        </div>
      )}
    </section>
  );
}
