"use client";

import { useEffect, useState, useRef } from "react";
import styles from "./Categories.module.css";
import { uploadToCloudinary } from "@/lib/uploadToCloudinary";

type Category = {
  _id: string;
  name: string;
  slug: string;
  image: string;
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories");
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error("Failed to fetch categories", error);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return alert("Category name required");
    setLoading(true);

    try {
      let imageUrl = preview;
      if (file) {
        imageUrl = await uploadToCloudinary(file);
      }
      if (!imageUrl) {
        alert("Image required");
        setLoading(false);
        return;
      }

      const payload = { name, image: imageUrl };
      const url = editingId ? `/api/categories/${editingId}` : "/api/categories";
      const method = editingId ? "PUT" : "POST";

      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      resetForm();
      fetchCategories();
    } catch (error) {
      alert("Operation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure? This action cannot be undone.")) return;
    try {
      await fetch(`/api/categories/${id}`, { method: "DELETE" });
      fetchCategories();
    } catch (error) {
      alert("Failed to delete");
    }
  };

  const handleEdit = (cat: Category) => {
    setEditingId(cat._id);
    setName(cat.name ?? "");
    setPreview(cat.image);
    setFile(null);
  };

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className={styles.dashboardContainer}>
      <header className={styles.header}>
        <div>
          <h1>Categories</h1>
          <p>Manage your product taxonomy and visual assets</p>
        </div>
        <div className={styles.stats}>
          <span>Total: <strong>{categories.length}</strong></span>
        </div>
      </header>

      <main className={styles.mainLayout}>
        {/* LEFT COLUMN: FORM */}
        <aside className={styles.formSidebar}>
          <form className={styles.card} onSubmit={handleSubmit}>
            <h3>{editingId ? "Edit Category" : "Create New Category"}</h3>
            
            <div className={styles.inputGroup}>
              <label>Category Name</label>
              <input
                type="text"
                placeholder="e.g. Electronics"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Cover Image</label>
              <div 
                className={styles.uploadArea} 
                onClick={() => fileInputRef.current?.click()}
              >
                {preview ? (
                  <img src={preview} alt="Preview" className={styles.previewImg} />
                ) : (
                  <div className={styles.uploadPlaceholder}>
                    <span>Click to upload image</span>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={handleImageChange}
                />
              </div>
            </div>

            <div className={styles.actions}>
              <button type="submit" className={styles.btnPrimary} disabled={loading}>
                {loading ? "Processing..." : editingId ? "Save Changes" : "Add Category"}
              </button>
              {editingId && (
                <button type="button" className={styles.btnGhost} onClick={resetForm}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </aside>

        {/* RIGHT COLUMN: GRID */}
        <section className={styles.contentArea}>
          <div className={styles.grid}>
            {categories.map((cat) => (
              <div key={cat._id} className={styles.categoryCard}>
                <div className={styles.imageWrapper}>
                  <img src={cat.image} alt={cat.name} />
                  <div className={styles.overlay}>
                     <button onClick={() => handleEdit(cat)} className={styles.iconBtn}>Edit</button>
                     <button onClick={() => handleDelete(cat._id)} className={`${styles.iconBtn} ${styles.danger}`}>Delete</button>
                  </div>
                </div>
                <div className={styles.cardInfo}>
                  <h4>{cat.name}</h4>
                  <code>/{cat.slug}</code>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}