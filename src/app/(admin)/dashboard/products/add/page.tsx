"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import styles from "./addproduct.module.css";

export default function AddProductPage() {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [image, setImage] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      await addDoc(collection(db, "products"), {
        name,
        price: Number(price),
        category,
        image,
        createdAt: serverTimestamp(),
      });
      setMessage("✅ Product added successfully!");
      setName("");
      setPrice("");
      setCategory("");
      setImage("");
    } catch (error: any) {
      setMessage("❌ Error adding product: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.container}>
      <form onSubmit={handleSubmit} className={styles.card}>
        <h1 className={styles.title}>Add New Product</h1>

        <input
          type="text"
          placeholder="Product name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={styles.input}
          required
        />
        <input
          type="number"
          placeholder="Price (LKR)"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className={styles.input}
          required
        />
        <input
          type="text"
          placeholder="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={styles.input}
          required
        />
        <input
          type="text"
          placeholder="Image URL"
          value={image}
          onChange={(e) => setImage(e.target.value)}
          className={styles.input}
          required
        />

        <button type="submit" className={styles.button} disabled={loading}>
          {loading ? "Adding..." : "Add Product"}
        </button>

        {message && <p className={styles.message}>{message}</p>}
      </form>
    </main>
  );
}
