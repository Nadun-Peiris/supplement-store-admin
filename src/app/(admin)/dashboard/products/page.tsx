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

  // Add modal
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

  // 🔹 Add product
  const handleAddProduct = async () => {
    if (!form.name || !form.price || !form.category || !form.imageUrl) {
      alert("Please fill all required fields and provide a local image path.");
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, "products"), {
        name: form.name,
        category: form.category,
        price: Number(form.price),
        stock: Number(form.stock),
        imageUrl: form.imageUrl,
        coaLink: form.coaLink || "",
        createdAt: serverTimestamp(),
      });

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

  if (loading) {
    return (
      <div className={styles.loading}>
        <p>Loading products...</p>
      </div>
    );
  }

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h1 className={styles.heading}>Products</h1>
        <button className={styles.addBtn} onClick={() => setShowModal(true)}>
          + Add Product
        </button>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
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
                  <td>{product.stock}</td>
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

      {/* 🪄 Add Product Modal */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>Add New Product</h2>
            <input
              type="text"
              placeholder="Product Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              type="text"
              placeholder="Category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
            <input
              type="number"
              placeholder="Price (LKR)"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
            <input
              type="number"
              placeholder="Stock"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
            />
            <input
              type="text"
              placeholder="/products/image-name.png"
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
            />
            <input
              type="text"
              placeholder="COA Link (optional)"
              value={form.coaLink}
              onChange={(e) => setForm({ ...form, coaLink: e.target.value })}
            />
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

      {/* ✏️ Edit Product Modal */}
      {editProduct && (
        <div className={styles.modalOverlay} onClick={() => setEditProduct(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>Edit Product</h2>
            <img
              src={editProduct.imageUrl}
              alt={editProduct.name}
              className={styles.productPreview}
            />
            <input
              type="text"
              value={editProduct.name}
              onChange={(e) =>
                setEditProduct({ ...editProduct, name: e.target.value })
              }
            />
            <input
              type="text"
              value={editProduct.category}
              onChange={(e) =>
                setEditProduct({ ...editProduct, category: e.target.value })
              }
            />
            <input
              type="number"
              value={editProduct.price}
              onChange={(e) =>
                setEditProduct({ ...editProduct, price: Number(e.target.value) })
              }
            />
            <input
              type="number"
              value={editProduct.stock}
              onChange={(e) =>
                setEditProduct({ ...editProduct, stock: Number(e.target.value) })
              }
            />
            <input
              type="text"
              value={editProduct.imageUrl}
              onChange={(e) =>
                setEditProduct({ ...editProduct, imageUrl: e.target.value })
              }
              placeholder="/products/image.png"
            />
            <input
              type="text"
              value={editProduct.coaLink || ""}
              onChange={(e) =>
                setEditProduct({ ...editProduct, coaLink: e.target.value })
              }
              placeholder="COA Link"
            />
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
          className={styles.modalOverlay}
          onClick={() => setConfirmDelete(null)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
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
              <button className={styles.deleteConfirmBtn} onClick={handleDeleteProduct}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
