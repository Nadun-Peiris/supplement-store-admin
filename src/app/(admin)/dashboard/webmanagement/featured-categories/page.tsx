"use client";

import { useEffect, useState, useRef } from "react";
import styles from "./FeaturedCategories.module.css";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";

import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

// --- Types ---
type Category = {
  _id: string;
  name: string;
  slug: string;
  image: string;
};

type Featured = {
  _id: string;
  index: number;
  categoryId: string;
  category: Category;
};

// --- Drag Handle Icon ---
const GripIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="5" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="19" r="1" />
    <circle cx="15" cy="5" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="19" r="1" />
  </svg>
);

// --- Sortable Row Component ---
function SortableFeaturedRow({
  item,
  onRemove,
  index,
}: {
  item: Featured;
  onRemove: (id: string) => void;
  index: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.featuredRow} ${isDragging ? styles.dragging : ""}`}
    >
      <div className={styles.rowLead}>
        <span className={styles.orderBadge}>{index + 1}</span>
        <div 
          ref={setActivatorNodeRef} 
          {...listeners} 
          {...attributes} 
          className={styles.dragHandle}
        >
          <GripIcon />
        </div>
      </div>

      <div className={styles.rowContent}>
        <img src={item.category.image} alt="" className={styles.rowThumb} />
        <div className={styles.rowText}>
          <span className={styles.catName}>{item.category.name}</span>
          <span className={styles.catSlug}>/{item.category.slug}</span>
        </div>
      </div>

      <button onClick={() => onRemove(item._id)} className={styles.removeBtn}>
        Remove
      </button>
    </div>
  );
}

// --- Main Page Component ---
export default function FeaturedCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [featured, setFeatured] = useState<Featured[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchInitialData = async () => {
    try {
      const [catRes, featRes] = await Promise.all([
        fetch("/api/categories"),
        fetch("/api/featured-categories")
      ]);
      const catData = await catRes.json();
      const featData = await featRes.json();
      
      setCategories(catData.categories || []);
      setFeatured((featData.items || []).sort((a: any, b: any) => a.index - b.index));
    } catch (error) {
      console.error("Fetch error", error);
    }
  };

  useEffect(() => { fetchInitialData(); }, []);

  const isFeatured = (id: string) => featured.some((f) => f.categoryId === id);

  const handleAddFeatured = async (categoryId: string) => {
    if (featured.length >= 8) return alert("Maximum 8 featured allowed");
    setLoading(true);
    try {
      await fetch("/api/featured-categories/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId }),
      });
      await fetchInitialData();
    } catch (error) {
      alert("Error adding category");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await fetch(`/api/featured-categories/${id}`, { method: "DELETE" });
      setFeatured(prev => prev.filter(f => f._id !== id));
    } catch (error) {
      alert("Failed to remove");
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const oldIndex = featured.findIndex((f) => f._id === active.id);
    const newIndex = featured.findIndex((f) => f._id === over.id);
    const newOrder = arrayMove(featured, oldIndex, newIndex);
    
    setFeatured(newOrder);

    try {
      await Promise.all(newOrder.map((item, i) => 
        fetch(`/api/featured-categories/${item._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ index: i }),
        })
      ));
    } catch (error) {
      console.error("Order save failed");
    }
  };

  const activeItem = activeId ? featured.find(f => f._id === activeId) : null;

  return (
    <div className={styles.pageWrapper}>
      <header className={styles.header}>
        <div>
          <h1>Featured Selection</h1>
          <p>Drag to reorder how categories appear on your homepage</p>
        </div>
        <div className={styles.counter}>
          <span className={featured.length >= 8 ? styles.full : ""}>
            {featured.length} / 8 slots filled
          </span>
        </div>
      </header>

      <main className={styles.layout}>
        {/* --- LEFT: ALL CATEGORIES --- */}
        <section className={styles.selectionArea}>
          <h2 className={styles.subTitle}>Available Categories</h2>
          <div className={styles.categoryGrid}>
            {categories.map((cat) => {
              const active = isFeatured(cat._id);
              return (
                <div key={cat._id} className={`${styles.miniCard} ${active ? styles.active : ""}`}>
                  <img src={cat.image} alt="" />
                  <div className={styles.miniInfo}>
                    <h4>{cat.name}</h4>
                    <button
                      disabled={active || featured.length >= 8 || loading}
                      onClick={() => handleAddFeatured(cat._id)}
                    >
                      {active ? "Selected" : "Add"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* --- RIGHT: FEATURED SORTING --- */}
        <section className={styles.featuredArea}>
          <h2 className={styles.subTitle}>Display Order</h2>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={(e) => setActiveId(String(e.active.id))}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={featured.map((f) => f._id)} strategy={verticalListSortingStrategy}>
              <div className={styles.sortableList}>
                {featured.map((item, index) => (
                  <SortableFeaturedRow 
                    key={item._id} 
                    item={item} 
                    index={index} 
                    onRemove={handleRemove} 
                  />
                ))}
                {featured.length === 0 && (
                  <div className={styles.emptyState}>
                    No featured categories yet. Add some from the left.
                  </div>
                )}
              </div>
            </SortableContext>

            <DragOverlay>
              {activeItem ? (
                <div className={`${styles.featuredRow} ${styles.overlayClone}`}>
                   <div className={styles.rowContent}>
                    <img src={activeItem.category.image} alt="" className={styles.rowThumb} />
                    <span className={styles.catName}>{activeItem.category.name}</span>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </section>
      </main>
    </div>
  );
}