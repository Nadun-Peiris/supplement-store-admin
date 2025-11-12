"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Bell, Package, AlertTriangle } from "lucide-react";
import styles from "./Notifications.module.css";

interface Notification {
  id: string;
  type: "order" | "stock";
  message: string;
  read: boolean;
  createdAt: any;
  readAt?: any;
}

export default function Notifications() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "order" | "stock">("all");

  // 🔹 Live Fetch from Firestore
  useEffect(() => {
    const q = query(collection(db, "notifications"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Notification[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          type: data.type || "order",
          message: data.message || "New update",
          read: data.read || false,
          createdAt: data.createdAt,
          readAt: data.readAt,
        });
      });
      setNotifications(list);
    });

    return () => unsubscribe();
  }, []);

  // 🔹 Mark all as read
  const markAllAsRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    for (const n of unread) {
      await updateDoc(doc(db, "notifications", n.id), {
        read: true,
        readAt: serverTimestamp(),
      });
    }
  };

  // 🔹 Mark a single notification as read
  const handleMarkAsRead = async (id: string) => {
    const notifRef = doc(db, "notifications", id);
    await updateDoc(notifRef, {
      read: true,
      readAt: serverTimestamp(),
    });
  };

  // 🔹 Auto-delete notifications 30 mins after being read
  useEffect(() => {
    const interval = setInterval(async () => {
      const now = new Date();

      for (const n of notifications) {
        if (n.read && n.readAt?.toDate) {
          const diffMinutes =
            (now.getTime() - n.readAt.toDate().getTime()) / (1000 * 60);
          if (diffMinutes > 30) {
            await deleteDoc(doc(db, "notifications", n.id));
          }
        }
      }
    }, 5 * 60 * 1000); // runs every 5 minutes

    return () => clearInterval(interval);
  }, [notifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const filtered =
    filter === "all"
      ? notifications
      : notifications.filter((n) => n.type === filter);

  return (
    <div className={styles.wrapper}>
      {/* 🔔 Bell Icon */}
      <button className={styles.bellBtn} onClick={() => setOpen(!open)}>
        <Bell size={20} />
        {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
      </button>

      {/* Dropdown */}
      {open && (
        <div className={styles.dropdown}>
          <div className={styles.header}>
            <h3>Notifications</h3>
            <button onClick={markAllAsRead} className={styles.markBtn}>
              Mark all as read
            </button>
          </div>

          {/* Filter buttons */}
          <div className={styles.filters}>
            {["all", "order", "stock"].map((f) => (
              <button
                key={f}
                className={`${styles.filterBtn} ${
                  filter === f ? styles.active : ""
                }`}
                onClick={() => setFilter(f as any)}
              >
                {f === "all" ? "All" : f === "order" ? "Orders" : "Stock"}
              </button>
            ))}
          </div>

          {/* Notification list */}
          <div className={styles.list}>
            {filtered.length === 0 ? (
              <p className={styles.empty}>No notifications</p>
            ) : (
              filtered.map((n) => (
                <div
                  key={n.id}
                  className={`${styles.item} ${!n.read ? styles.unread : ""}`}
                  onClick={() => handleMarkAsRead(n.id)}
                >
                  {n.type === "order" ? (
                    <Package size={16} className={styles.icon} />
                  ) : (
                    <AlertTriangle size={16} className={styles.icon} />
                  )}
                  <div>
                    <p>{n.message}</p>
                    <span className={styles.time}>
                      {n.createdAt?.toDate
                        ? new Date(n.createdAt.toDate()).toLocaleString()
                        : "Just now"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
