"use client";

import { useEffect, useState, useRef } from "react";
import styles from "../categories/Categories.module.css";
import { uploadToCloudinary } from "@/lib/uploadToCloudinary";

type Brand = {
  _id: string;
  name: string;
  slug: string;
  image?: string;
};

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchBrands = async () => {
    try {
      const res = await fetch("/api/brands");
      const data = await res.json();
      setBrands(data.brands || []);
    } catch (error) {
      console.error("Failed to fetch brands", error);
    }
  };

  useEffect(() => {
    fetchBrands();
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return alert("Brand name required");

    setLoading(true);

    try {
      let imageUrl = preview;

      if (file) {
        imageUrl = await uploadToCloudinary(file);
      }

      const payload = { name, image: imageUrl };

      const url = editingId
        ? `/api/brands/${editingId}`
        : "/api/brands";

      const method = editingId ? "PUT" : "POST";

      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      resetForm();
      fetchBrands();
    } catch (error) {
      alert("Operation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure? This action cannot be undone.")) return;

    try {
      await fetch(`/api/brands/${id}`, {
        method: "DELETE",
      });

      fetchBrands();
    } catch (error) {
      alert("Failed to delete brand");
    }
  };

  const handleEdit = (brand: Brand) => {
    setEditingId(brand._id);
    setName(brand.name ?? "");
    setPreview(brand.image || null);
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
          <h1>Brands</h1>
          <p>Manage your product brands and logos</p>
        </div>
        <div className={styles.stats}>
          <span>
            Total: <strong>{brands.length}</strong>
          </span>
        </div>
      </header>

      <main className={styles.mainLayout}>
        {/* LEFT COLUMN: FORM */}
        <aside className={styles.formSidebar}>
          <form className={styles.card} onSubmit={handleSubmit}>
            <h3>{editingId ? "Edit Brand" : "Create New Brand"}</h3>

            <div className={styles.inputGroup}>
              <label>Brand Name</label>
              <input
                type="text"
                placeholder="e.g. Optimum Nutrition"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Brand Logo (Optional)</label>
              <div
                className={styles.uploadArea}
                onClick={() => fileInputRef.current?.click()}
              >
                {preview ? (
                  <img
                    src={preview}
                    alt="Preview"
                    className={styles.previewImg}
                  />
                ) : (
                  <div className={styles.uploadPlaceholder}>
                    <span>Click to upload logo</span>
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
              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={loading}
              >
                {loading
                  ? "Processing..."
                  : editingId
                  ? "Save Changes"
                  : "Add Brand"}
              </button>

              {editingId && (
                <button
                  type="button"
                  className={styles.btnGhost}
                  onClick={resetForm}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </aside>

        {/* RIGHT COLUMN: GRID */}
        <section className={styles.contentArea}>
          <div className={styles.grid}>
            {brands.map((brand) => (
              <div key={brand._id} className={styles.categoryCard}>
                <div className={styles.imageWrapper}>
                  <img
                    src={brand.image || "/placeholder.png"}
                    alt={brand.name}
                  />
                  <div className={styles.overlay}>
                    <button
                      onClick={() => handleEdit(brand)}
                      className={styles.iconBtn}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(brand._id)}
                      className={`${styles.iconBtn} ${styles.danger}`}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className={styles.cardInfo}>
                  <h4>{brand.name}</h4>
                  <code>/{brand.slug}</code>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
