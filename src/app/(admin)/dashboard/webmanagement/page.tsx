"use client";

import { useEffect, useState } from "react";
import styles from "./webmanagement.module.css";

interface Category {
  _id: string;
  name: string;
  slug: string;
  image: string;
}

interface FeaturedItem {
  _id: string;
  categoryId: string;
  index: number;
  category: {
    _id: string;
    name: string;
    slug: string;
    image: string;
  };
}

export default function WebsiteManagementPage() {
  const [featured, setFeatured] = useState<FeaturedItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  /* -------------------------------------------------------
     LOAD FEATURED CATEGORIES
  -------------------------------------------------------- */
  const loadFeatured = async () => {
    setLoading(true);

    const res = await fetch("/api/featured-categories");
    const data = await res.json();

    setFeatured(data.items || []);
    setLoading(false);
  };

  /* -------------------------------------------------------
     LOAD NORMAL CATEGORIES WHEN MODAL OPENS
  -------------------------------------------------------- */
  useEffect(() => {
    if (!isModalOpen) return;

    async function loadCats() {
      const res = await fetch("/api/categories");
      const data = await res.json();

      const featuredIDs = featured.map((f) => f.categoryId);

      const available = (data.categories || []).filter(
        (c: Category) => !featuredIDs.includes(c._id)
      );

      setCategories(available);
    }

    loadCats();
  }, [isModalOpen, featured]);

  useEffect(() => {
    loadFeatured();
  }, []);

  /* -------------------------------------------------------
     ADD FEATURED CATEGORY
  -------------------------------------------------------- */
  const saveCategory = async () => {
    if (!selectedCategory) return alert("Select a category first!");

    const res = await fetch("/api/featured-categories/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: selectedCategory }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Failed to add category");
      return;
    }

    setIsModalOpen(false);
    setSelectedCategory("");

    loadFeatured();
  };

  /* -------------------------------------------------------
     DELETE FEATURED CATEGORY
  -------------------------------------------------------- */
  const deleteItem = async (id: string) => {
    if (!confirm("Delete this featured category?")) return;

    await fetch(`/api/featured-categories/${id}`, {
      method: "DELETE",
    });

    loadFeatured();
  };

  /* -------------------------------------------------------
     UPDATE SORT INDEX
  -------------------------------------------------------- */
  const updateIndex = async (id: string, index: number) => {
    await fetch(`/api/featured-categories/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ index }),
    });

    loadFeatured();
  };

  /* -------------------------------------------------------
     UI OUTPUT
  -------------------------------------------------------- */
  return (
    <section className={styles.section}>
      {/* HEADER */}
      <div className={styles.header}>
        <h2 className={styles.heading}>Website Management - Featured Categories</h2>
        <button
          className={styles.addBtn}
          onClick={() => {
            setSelectedCategory("");
            setIsModalOpen(true);
          }}
        >
          + Add Featured Category
        </button>
      </div>

      {/* TABLE */}
      <div className={styles.tableWrapper}>
        {loading ? (
          <div className={styles.loading}>Loading...</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Image</th>
                <th>Name</th>
                <th>Slug</th>
                <th>Index</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {featured.map((item) => (
                <tr key={item._id}>
                  <td>
                    <img
                      src={item.category.image}
                      className={styles.productImage}
                      alt={item.category.name}
                    />
                  </td>

                  <td>{item.category.name}</td>
                  <td>{item.category.slug}</td>

                  <td>
                    <input
                      type="number"
                      value={item.index}
                      style={{ width: 60 }}
                      onChange={(e) =>
                        updateIndex(item._id, Number(e.target.value))
                      }
                    />
                  </td>

                  <td>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => deleteItem(item._id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2>Add Featured Category</h2>

            <label>Select Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{
                background: "white",
                color: "black",
                padding: "8px",
                borderRadius: "6px",
              }}
            >
              <option value="">Select a category</option>
              {categories.map((cat) => (
                <option key={cat._id} value={cat._id}>
                  {cat.name}
                </option>
              ))}
            </select>

            <div className={styles.modalActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </button>

              <button className={styles.saveBtn} onClick={saveCategory}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
