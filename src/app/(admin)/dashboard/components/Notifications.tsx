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
    <div className="relative inline-block">
      {/* 🔔 Bell Icon Button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-[#cfeef7] bg-white text-[#aaa] shadow-sm transition hover:border-[#03c7fe] hover:text-[#03c7fe]"
        aria-label="Toggle notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white shadow-sm ring-2 ring-white">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Invisible Overlay to close dropdown when clicking outside */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Dropdown Panel */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-3 w-80 origin-top-right rounded-[28px] border border-white bg-white/90 p-5 shadow-[0_20px_50px_rgba(3,199,254,0.15)] backdrop-blur-xl sm:w-96 animate-in fade-in zoom-in-95 duration-200">
          
          <div className="flex items-center justify-between border-b border-[#e0f4fb] pb-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-[#111]">
              Notifications
            </h3>
            <button
              onClick={markAllAsRead}
              className="text-[10px] font-black uppercase tracking-widest text-[#03c7fe] transition hover:underline"
            >
              Mark all as read
            </button>
          </div>

          {/* Filter buttons */}
          <div className="mt-4 flex gap-1.5 rounded-2xl border border-[#cfeef7] bg-[#fbfdff] p-1.5">
            {(["all", "order", "stock"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 rounded-xl py-2 text-[10px] font-black uppercase tracking-wider transition-colors ${
                  filter === f
                    ? "bg-[#03c7fe] text-white shadow-[0_4px_10px_rgba(3,199,254,0.2)]"
                    : "text-[#888] hover:bg-[#e0f4fb]"
                }`}
              >
                {f === "all" ? "All" : f === "order" ? "Orders" : "Stock"}
              </button>
            ))}
          </div>

          {/* Notification list */}
          <div className="mt-5 flex max-h-[50vh] flex-col gap-3 overflow-y-auto pr-1 hide-scrollbar">
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-xs font-bold text-[#aaa]">
                No notifications right now.
              </p>
            ) : (
              filtered.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleMarkAsRead(n.id)}
                  className={`flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition-all ${
                    !n.read
                      ? "border-[#cfeef7] bg-[#fbfdff] shadow-sm hover:border-[#03c7fe]"
                      : "border-transparent bg-transparent opacity-60 hover:bg-[#f2fbff]"
                  }`}
                >
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      n.type === "order"
                        ? "bg-[#f2fbff] text-[#03c7fe]"
                        : "bg-amber-50 text-amber-500"
                    }`}
                  >
                    {n.type === "order" ? (
                      <Package size={14} />
                    ) : (
                      <AlertTriangle size={14} />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <p className={`text-xs ${!n.read ? "font-black text-[#111]" : "font-bold text-[#555]"}`}>
                      {n.message}
                    </p>
                    <span className="mt-1 text-[10px] font-bold text-[#888]">
                      {n.createdAt?.toDate
                        ? new Date(n.createdAt.toDate()).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })
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