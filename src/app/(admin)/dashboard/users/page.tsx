"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import styles from "./users.module.css";

interface UserData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  createdAt?: string;
  totalOrders?: number;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("orders");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 10;

  // 🔹 Fetch users and count orders
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        const ordersSnap = await getDocs(collection(db, "orders"));

        const list: UserData[] = usersSnap.docs.map((userDoc) => {
          const data = userDoc.data();
          const orderCount = ordersSnap.docs.filter(
            (o) => o.data().email === data.email
          ).length;

          return {
            id: userDoc.id,
            name: data.name || "Unknown",
            email: data.email || "N/A",
            phone: data.phone || "N/A",
            totalOrders: orderCount,
            createdAt: data.createdAt?.toDate
              ? data.createdAt.toDate().toLocaleDateString()
              : "N/A",
          };
        });

        setUsers(list);
        setFilteredUsers(list);
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // 🔍 Apply filter and sort manually on button click
  const handleSearch = () => {
    let filtered = [...users];

    if (searchTerm.trim() !== "") {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.name.toLowerCase().includes(search) ||
          u.email.toLowerCase().includes(search) ||
          u.phone?.toLowerCase().includes(search) ||
          u.createdAt?.toLowerCase().includes(search)
      );
    }

    if (sortBy === "orders") {
      filtered.sort((a, b) => (b.totalOrders ?? 0) - (a.totalOrders ?? 0));
    } else if (sortBy === "date") {
      filtered.sort(
        (a, b) =>
          new Date(b.createdAt ?? "").getTime() -
          new Date(a.createdAt ?? "").getTime()
      );
    } else if (sortBy === "name") {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    setFilteredUsers(filtered);
    setCurrentPage(1);
  };

  // Pagination logic
  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);

  if (loading) {
    return (
      <div className={styles.loading}>
        <p>Loading users...</p>
      </div>
    );
  }

  return (
    <section className={`${styles.section} space-y-6`}>
      <div
        className={`${styles.header} flex-col gap-4 lg:flex-row lg:items-center lg:justify-between`}
      >
        <h1 className={styles.heading}>Customers</h1>

        <div
          className={`${styles.controls} w-full flex-col gap-3 sm:flex-row sm:items-center`}
        >
          <input
            type="text"
            placeholder="Search name, email, phone, or date..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`${styles.search} w-full sm:flex-1`}
          />
          <button
            className={`${styles.searchBtn} w-full sm:w-auto`}
            onClick={handleSearch}
          >
            Search
          </button>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className={`${styles.select} w-full sm:w-48`}
          >
            <option value="orders">Sort by Orders</option>
            <option value="date">Sort by Joined Date</option>
          </select>
        </div>
      </div>

      <div className={`${styles.tableWrapper} overflow-x-auto`}>
        <table className={`${styles.table} min-w-[720px]`}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Total Orders</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {currentUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.empty}>
                  No customers found
                </td>
              </tr>
            ) : (
              currentUsers.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.phone}</td>
                  <td>{u.totalOrders}</td>
                  <td>{u.createdAt}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {filteredUsers.length > usersPerPage && (
        <div className={`${styles.pagination} flex-wrap gap-3`}>
          <button
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            disabled={currentPage === 1}
          >
            ← Prev
          </button>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() =>
              setCurrentPage((p) => Math.min(p + 1, totalPages))
            }
            disabled={currentPage === totalPages}
          >
            Next →
          </button>
        </div>
      )}
    </section>
  );
}
