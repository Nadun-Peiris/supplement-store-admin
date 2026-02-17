"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { uploadToCloudinary } from "@/lib/uploadToCloudinary";
import styles from "./products.module.css";
import { Edit2, Plus, Search, Trash2, X } from "lucide-react";

type Product = {
  _id: string;
  name: string;
  slug: string;
  category: string;
  brandName: string;
  price: number;
  stock: number;
  image: string;
  hoverImage?: string;
  description?: string;
  isActive: boolean;
};

type Category = { _id: string; name: string };
type Brand = { _id: string; name: string };

type ProductFormState = {
  name: string;
  category: string;
  brandName: string;
  price: string;
  stock: string;
  image: string;
  hoverImage: string;
  description: string;
  isActive: boolean;
};

const initialForm: ProductFormState = {
  name: "",
  category: "",
  brandName: "",
  price: "",
  stock: "0",
  image: "",
  hoverImage: "",
  description: "",
  isActive: true,
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  const [form, setForm] = useState<ProductFormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const [mainImageFile, setMainImageFile] = useState<File | null>(null);
  const [hoverImageFile, setHoverImageFile] = useState<File | null>(null);

  const mainFileInputRef = useRef<HTMLInputElement>(null);
  const hoverFileInputRef = useRef<HTMLInputElement>(null);

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/products");
      const data = (await res.json()) as { products?: Product[] };
      setProducts(data.products || []);
    } catch (error) { console.error("Failed to fetch products", error); }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories");
      const data = (await res.json()) as { categories?: Category[] };
      setCategories(data.categories || []);
    } catch (error) { console.error("Failed to fetch categories", error); }
  };

  const fetchBrands = async () => {
    try {
      const res = await fetch("/api/brands");
      const data = (await res.json()) as { brands?: Brand[] };
      setBrands(data.brands || []);
    } catch (error) { console.error("Failed to fetch brands", error); }
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchBrands();
  }, []);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return products;
    return products.filter((product) => 
      product.name.toLowerCase().includes(query) ||
      product.brandName?.toLowerCase().includes(query) ||
      product.category.toLowerCase().includes(query)
    );
  }, [products, searchQuery]);

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
    setMainImageFile(null);
    setHoverImageFile(null);
    if (mainFileInputRef.current) mainFileInputRef.current.value = "";
    if (hoverFileInputRef.current) hoverFileInputRef.current.value = "";
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleEdit = (product: Product) => {
    setEditingId(product._id);
    setForm({
      name: product.name,
      category: product.category,
      brandName: product.brandName || "",
      price: String(product.price),
      stock: String(product.stock ?? 0),
      image: product.image,
      hoverImage: product.hoverImage || "",
      description: product.description || "",
      isActive: product.isActive,
    });
    setMainImageFile(null);
    setHoverImageFile(null);
    setIsModalOpen(true);
  };

  const handleMainImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setMainImageFile(selected);
    setForm((prev) => ({ ...prev, image: URL.createObjectURL(selected) }));
  };

  const handleHoverImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setHoverImageFile(selected);
    setForm((prev) => ({ ...prev, hoverImage: URL.createObjectURL(selected) }));
  };

  const handleDelete = async (id: string) => {
    const confirmed = confirm("Are you sure? This action cannot be undone.");
    if (!confirmed) return;
    try {
      await fetch(`/api/products/${id}`, { method: "DELETE" });
      fetchProducts();
    } catch (error) { alert("Failed to delete product"); }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.name || !form.category || !form.price || !form.image) {
      alert("Name, category, price and main image are required.");
      return;
    }
    setLoading(true);
    try {
      let imageUrl = form.image;
      let hoverImageUrl = form.hoverImage;
      if (mainImageFile) imageUrl = await uploadToCloudinary(mainImageFile);
      if (hoverImageFile) hoverImageUrl = await uploadToCloudinary(hoverImageFile);

      const payload = {
        ...form,
        price: Number(form.price),
        stock: Number(form.stock || "0"),
        image: imageUrl,
        hoverImage: hoverImageUrl,
      };

      const url = editingId ? `/api/products/${editingId}` : "/api/products";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save product");
      closeModal();
      fetchProducts();
    } catch (error) {
      alert("Operation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.dashboardContainer}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>Products</h1>
          <div className={styles.searchWrapper}>
            <Search size={18} />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <button className={styles.addBtn} onClick={openCreateModal}>
          <Plus size={18} />
          Add Product
        </button>
      </header>

      <main className={styles.tableContainer}>
        <table className={styles.productTable}>
          <thead>
            <tr>
              <th>Image</th>
              <th>Name</th>
              <th>Category</th>
              <th>Brand</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((product) => (
              <tr key={product._id}>
                <td>
                  <img src={product.image || "/placeholder.png"} className={styles.tableThumb} />
                </td>
                <td className={styles.pName}>{product.name}</td>
                <td>{product.category}</td>
                <td>{product.brandName || "-"}</td>
                <td>LKR {product.price.toLocaleString()}</td>
                <td>{product.stock}</td>
                <td>
                  <span className={product.isActive ? styles.statusActive : styles.statusInactive}>
                    {product.isActive ? "Active" : "Hidden"}
                  </span>
                </td>
                <td className={styles.actions}>
                  <button type="button" onClick={() => handleEdit(product)} className={styles.editBtn}>
                    <Edit2 size={16} />
                  </button>
                  <button type="button" onClick={() => handleDelete(product._id)} className={styles.deleteBtn}>
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>{editingId ? "Edit Product" : "New Product"}</h3>
              <button type="button" onClick={closeModal} className={styles.closeBtn}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className={styles.formGrid}>
              <div className={styles.inputGroup}>
                <label>Product Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div className={styles.inputRow}>
                <div className={styles.inputGroup}>
                  <label>Category</label>
                  <select value={form.category} onChange={(e) => setForm(p => ({ ...p, category: e.target.value }))} required>
                    <option value="">Select category</option>
                    {categories.map((c) => <option key={c._id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div className={styles.inputGroup}>
                  <label>Brand</label>
                  <select value={form.brandName} onChange={(e) => setForm(p => ({ ...p, brandName: e.target.value }))}>
                    <option value="">No brand</option>
                    {brands.map((b) => <option key={b._id} value={b.name}>{b.name}</option>)}
                  </select>
                </div>
              </div>

              <div className={styles.inputRow}>
                <div className={styles.inputGroup}>
                  <label>Price (LKR)</label>
                  <input type="number" value={form.price} onChange={(e) => setForm(p => ({ ...p, price: e.target.value }))} required />
                </div>
                <div className={styles.inputGroup}>
                  <label>Stock</label>
                  <input type="number" value={form.stock} onChange={(e) => setForm(p => ({ ...p, stock: e.target.value }))} />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label>Visibility Status</label>
                <select value={form.isActive ? "active" : "hidden"} onChange={(e) => setForm(p => ({ ...p, isActive: e.target.value === "active" }))}>
                  <option value="active">Active (Visible)</option>
                  <option value="hidden">Hidden</option>
                </select>
              </div>

              <div className={styles.imageUploadRow}>
                <div className={styles.imageBox}>
                  <label>Main Image</label>
                  <input type="file" ref={mainFileInputRef} onChange={handleMainImageChange} hidden />
                  <div className={styles.imagePlaceholder} onClick={() => mainFileInputRef.current?.click()}>
                    {form.image ? <img src={form.image} /> : <Plus />}
                  </div>
                </div>
                <div className={styles.imageBox}>
                  <label>Hover Image</label>
                  <input type="file" ref={hoverFileInputRef} onChange={handleHoverImageChange} hidden />
                  <div className={styles.imagePlaceholder} onClick={() => hoverFileInputRef.current?.click()}>
                    {form.hoverImage ? <img src={form.hoverImage} /> : <Plus />}
                  </div>
                </div>
              </div>

              <div className={styles.inputGroupFull}>
                <label>Description</label>
                <textarea rows={3} value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>

              <div className={styles.formActions}>
                <button type="button" onClick={closeModal} className={styles.btnGhost}>Cancel</button>
                <button type="submit" className={styles.btnPrimary} disabled={loading}>
                  {loading ? "Processing..." : editingId ? "Update Product" : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}