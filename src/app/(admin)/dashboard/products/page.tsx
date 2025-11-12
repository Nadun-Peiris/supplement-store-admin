"use client";

import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  FieldValue,
  doc,
  deleteDoc,
  updateDoc,
  getDocs,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import styles from "./products.module.css";

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  imageUrl: string;
  coaLink?: string;
  createdAt?: string | FieldValue;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "",
    price: "",
    stock: "",
    imageUrl: "",
    coaLink: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // Edit/Delete states
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);

  // 🔹 Real-time Firestore listener
  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Product[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          name: data.name || "Unnamed Product",
          category: data.category || "Uncategorized",
          price: data.price || 0,
          stock: data.stock || 0,
          imageUrl: data.imageUrl || "/products/placeholder.png",
          coaLink: data.coaLink || "",
          createdAt: data.createdAt?.toDate
            ? data.createdAt.toDate().toLocaleDateString()
            : "N/A",
        });
      });
      setProducts(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 🧠 Utility: avoid duplicate low-stock notifications
  const sendLowStockNotification = async (name: string, stock: number) => {
    try {
      // Check if a recent notification already exists
      const notifQuery = query(
        collection(db, "notifications"),
        where("message", "==", `${name} stock is running low (${stock} left)`)
      );
      const existing = await getDocs(notifQuery);
      if (!existing.empty) return; // already notified

      await addDoc(collection(db, "notifications"), {
        type: "stock",
        message: `${name} stock is running low (${stock} left)`,
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error creating notification:", error);
    }
  };

  // 🔹 Add product
  const handleAddProduct = async () => {
    if (!form.name || !form.price || !form.category || !form.imageUrl) {
      alert("Please fill all required fields and provide a local image path.");
      return;
    }

    setSubmitting(true);
    try {
      const newProduct = {
        name: form.name,
        category: form.category,
        price: Number(form.price),
        stock: Number(form.stock),
        imageUrl: form.imageUrl,
        coaLink: form.coaLink || "",
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "products"), newProduct);

      // ⚠️ Low stock notification
      if (Number(form.stock) < 5) {
        await sendLowStockNotification(form.name, Number(form.stock));
      }

      setForm({
        name: "",
        category: "",
        price: "",
        stock: "",
        imageUrl: "",
        coaLink: "",
      });
      setShowModal(false);
    } catch (error) {
      console.error("Error adding product:", error);
      alert("Error adding product. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // 🔹 Update product
  const handleUpdateProduct = async () => {
    if (!editProduct) return;

    try {
      const productRef = doc(db, "products", editProduct.id);
      await updateDoc(productRef, {
        name: editProduct.name,
        category: editProduct.category,
        price: editProduct.price,
        stock: editProduct.stock,
        imageUrl: editProduct.imageUrl,
        coaLink: editProduct.coaLink || "",
      });

      // ⚠️ Low stock check
      if (editProduct.stock < 5) {
        await sendLowStockNotification(editProduct.name, editProduct.stock);
      }

      setEditProduct(null);
    } catch (error) {
      console.error("Error updating product:", error);
      alert("Failed to update product");
    }
  };

  // 🔹 Delete product
  const handleDeleteProduct = async () => {
    if (!confirmDelete) return;
    try {
      await deleteDoc(doc(db, "products", confirmDelete.id));
      setConfirmDelete(null);
    } catch (error) {
      console.error("Error deleting product:", error);
      alert("Failed to delete product");
    }
  };

  // 🕒 Auto-delete old low-stock notifications (after 30 mins)
  useEffect(() => {
    const interval = setInterval(async () => {
      const now = new Date();
      const snap = await getDocs(collection(db, "notifications"));
      snap.forEach(async (docSnap) => {
        const data = docSnap.data();
        if (data.type === "stock" && data.createdAt?.toDate) {
          const mins =
            (now.getTime() - data.createdAt.toDate().getTime()) / (1000 * 60);
          if (mins > 30) await deleteDoc(doc(db, "notifications", docSnap.id));
        }
      });
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className={styles.loading}>
        <p>Loading products...</p>
      </div>
    );
  }

  return (
    <section className={`${styles.section} space-y-6`}>
      {/* Header */}
      <div
        className={`${styles.header} flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}
      >
        <h1 className={styles.heading}>Products</h1>
        <button
          className={`${styles.addBtn} w-full sm:w-auto`}
          onClick={() => setShowModal(true)}
        >
          + Add Product
        </button>
      </div>

      {/* Table */}
      <div className={`${styles.tableWrapper} overflow-x-auto`}>
        <table className={`${styles.table} min-w-[720px]`}>
          <thead>
            <tr>
              <th>Image</th>
              <th>Name</th>
              <th>Category</th>
              <th>Price (LKR)</th>
              <th>Stock</th>
              <th>COA</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.empty}>
                  No products found
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product.id}>
                  <td>
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className={styles.productImage}
                    />
                  </td>
                  <td>{product.name}</td>
                  <td>{product.category}</td>
                  <td>{product.price.toLocaleString()}</td>
                  <td
                    className={product.stock < 5 ? styles.lowStock : undefined}
                  >
                    {product.stock}
                  </td>
                  <td>
                    {product.coaLink ? (
                      <a
                        href={product.coaLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.link}
                      >
                        View
                      </a>
                    ) : (
                      <span className={styles.noCoa}>N/A</span>
                    )}
                  </td>
                  <td>
                    <button
                      className={styles.editBtn}
                      onClick={() => setEditProduct(product)}
                    >
                      Edit
                    </button>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => setConfirmDelete(product)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 🪄 Add Modal */}
      {showModal && (
        <div
          className={`${styles.modalOverlay} px-4`}
          onClick={() => setShowModal(false)}
        >
          <div
            className={`${styles.modal} w-full max-w-md sm:max-w-lg`}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Add New Product</h2>
            {["name", "category", "price", "stock", "imageUrl", "coaLink"].map(
              (field) => (
                <input
                  key={field}
                  type={field === "price" || field === "stock" ? "number" : "text"}
                  placeholder={
                    field === "imageUrl"
                      ? "/products/image-name.png"
                      : field === "coaLink"
                      ? "COA Link (optional)"
                      : field[0].toUpperCase() + field.slice(1)
                  }
                  value={(form as any)[field]}
                  onChange={(e) =>
                    setForm({ ...form, [field]: e.target.value })
                  }
                />
              )
            )}
            <div className={styles.modalActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                className={styles.saveBtn}
                onClick={handleAddProduct}
                disabled={submitting}
              >
                {submitting ? "Saving..." : "Save Product"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✏️ Edit Modal */}
      {editProduct && (
        <div
          className={`${styles.modalOverlay} px-4`}
          onClick={() => setEditProduct(null)}
        >
          <div
            className={`${styles.modal} w-full max-w-md sm:max-w-lg`}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Edit Product</h2>
            <img
              src={editProduct.imageUrl}
              alt={editProduct.name}
              className={styles.productPreview}
            />
            {["name", "category", "price", "stock", "imageUrl", "coaLink"].map(
              (field) => (
                <input
                  key={field}
                  type={field === "price" || field === "stock" ? "number" : "text"}
                  value={(editProduct as any)[field] || ""}
                  onChange={(e) =>
                    setEditProduct({
                      ...editProduct,
                      [field]:
                        field === "price" || field === "stock"
                          ? Number(e.target.value)
                          : e.target.value,
                    })
                  }
                />
              )
            )}
            <div className={styles.modalActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => setEditProduct(null)}
              >
                Cancel
              </button>
              <button className={styles.saveBtn} onClick={handleUpdateProduct}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🗑️ Delete Confirmation */}
      {confirmDelete && (
        <div
          className={`${styles.modalOverlay} px-4`}
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className={`${styles.modal} w-full max-w-md sm:max-w-lg`}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Delete Product</h2>
            <p>
              Are you sure you want to delete{" "}
              <strong>{confirmDelete.name}</strong>?
            </p>
            <div className={styles.modalActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>
              <button
                className={styles.deleteConfirmBtn}
                onClick={handleDeleteProduct}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
