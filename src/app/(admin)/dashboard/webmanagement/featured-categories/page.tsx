"use client";

import { useEffect, useState } from "react";
import { GripVertical, Trash2, CheckCircle2, AlertCircle, Info } from "lucide-react";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
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

type Toast = {
  message: string;
  type: "success" | "error" | "info";
  id: number;
};

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
    zIndex: isDragging ? 50 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-3 transition-all ${
        isDragging ? "scale-[1.02] opacity-80 shadow-xl ring-2 ring-[#01C7FE]" : "shadow-sm hover:shadow-md"
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Order Badge */}
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-700">
          {index + 1}
        </span>
        
        {/* Drag Handle */}
        <div
          ref={setActivatorNodeRef}
          {...listeners}
          {...attributes}
          className="cursor-grab text-gray-400 transition-colors hover:text-[#01C7FE] active:cursor-grabbing"
        >
          <GripVertical size={20} />
        </div>

        {/* Info */}
        <div className="flex items-center gap-3 pl-2">
          <img src={item.category.image} alt={item.category.name} className="h-10 w-14 rounded-md bg-gray-50 object-cover" />
          <div className="flex flex-col">
            <span className="text-sm font-bold text-gray-900">{item.category.name}</span>
            <span className="text-xs text-gray-500">/{item.category.slug}</span>
          </div>
        </div>
      </div>

      <button
        onClick={() => onRemove(item._id)}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
        title="Remove from featured"
      >
        <Trash2 size={16} />
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
  const [toasts, setToasts] = useState<Toast[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  /* ---------------- TOAST HELPER ---------------- */
  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { message, type, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

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
      showToast("Failed to load categories.", "error");
    }
  };

  useEffect(() => { fetchInitialData(); }, []);

  const isFeatured = (id: string) => featured.some((f) => f.categoryId === id);

  const handleAddFeatured = async (categoryId: string) => {
    if (featured.length >= 8) {
      return showToast("Maximum 8 featured categories allowed.", "error");
    }
    setLoading(true);
    try {
      const res = await fetch("/api/featured-categories/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId }),
      });
      if (!res.ok) throw new Error("Failed to add");
      await fetchInitialData();
      showToast("Category added to featured list.", "success");
    } catch (error) {
      showToast("Error adding category.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      const res = await fetch(`/api/featured-categories/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove");
      setFeatured(prev => prev.filter(f => f._id !== id));
      showToast("Category removed from featured.", "info");
    } catch (error) {
      showToast("Failed to remove category.", "error");
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
      showToast("Order updated successfully.", "success");
    } catch (error) {
      console.error("Order save failed");
      showToast("Failed to save new order.", "error");
    }
  };

  const activeItem = activeId ? featured.find(f => f._id === activeId) : null;

  return (
    <div className="flex flex-col gap-8 relative min-h-[80vh]">
      
      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg transition-all animate-in slide-in-from-right-8 pointer-events-auto ${
              toast.type === "success"
                ? "bg-emerald-600"
                : toast.type === "error"
                ? "bg-red-600"
                : "bg-gray-800"
            }`}
          >
            {toast.type === "success" && <CheckCircle2 size={18} />}
            {toast.type === "error" && <AlertCircle size={18} />}
            {toast.type === "info" && <Info size={18} />}
            {toast.message}
          </div>
        ))}
      </div>

      {/* Page Header */}
      <header className="flex flex-col gap-4 border-b border-gray-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-gray-900">Featured Categories</h1>
          <p className="text-sm text-gray-500">Drag to reorder how categories appear on your homepage</p>
        </div>
        <div className={`flex items-center gap-2 rounded-lg border px-4 py-2 shadow-sm ${
          featured.length >= 8 ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"
        }`}>
          <span className="text-sm font-medium text-gray-500">Slots Filled:</span>
          <strong className={`text-lg font-bold ${featured.length >= 8 ? "text-red-600" : "text-[#01C7FE]"}`}>
            {featured.length} / 8
          </strong>
        </div>
      </header>

      {/* Main Layout Grid */}
      <main className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">
        
        {/* LEFT: Available Categories */}
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-gray-900">Available Categories</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {categories.map((cat) => {
              const active = isFeatured(cat._id);
              return (
                <div 
                  key={cat._id} 
                  className={`flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-all ${
                    active ? "border-[#01C7FE] ring-1 ring-[#01C7FE] opacity-60" : "border-gray-200 hover:shadow-md"
                  }`}
                >
                  <div className="h-24 w-full bg-gray-100 overflow-hidden">
                    <img src={cat.image} alt={cat.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="flex flex-col gap-3 p-3">
                    <h4 className="text-sm font-bold text-gray-900 truncate">{cat.name}</h4>
                    <button
                      disabled={active || featured.length >= 8 || loading}
                      onClick={() => handleAddFeatured(cat._id)}
                      className={`w-full rounded-md py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
                        active 
                          ? "bg-gray-100 text-gray-400" 
                          : "bg-[#01C7FE]/10 text-[#01C7FE] hover:bg-[#01C7FE] hover:text-white"
                      }`}
                    >
                      {active ? "Selected" : "Add to Featured"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* RIGHT: Display Order (Draggable) */}
        <section className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-gray-50 p-5 shadow-inner">
          <h2 className="text-lg font-bold text-gray-900">Homepage Display Order</h2>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={(e) => setActiveId(String(e.active.id))}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={featured.map((f) => f._id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-3">
                {featured.map((item, index) => (
                  <SortableFeaturedRow 
                    key={item._id} 
                    item={item} 
                    index={index} 
                    onRemove={handleRemove} 
                  />
                ))}
                {featured.length === 0 && (
                  <div className="flex h-32 flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white text-gray-500">
                    <p className="text-sm">No featured categories yet.</p>
                    <p className="text-xs">Add some from the left.</p>
                  </div>
                )}
              </div>
            </SortableContext>

            {/* Dragging Overlay Clone */}
            <DragOverlay>
              {activeItem ? (
                <div className="flex items-center gap-4 rounded-xl border-2 border-[#01C7FE] bg-white p-3 shadow-2xl opacity-90">
                   <div className="flex items-center gap-3 pl-2">
                    <img src={activeItem.category.image} alt="" className="h-10 w-14 rounded-md bg-gray-50 object-cover" />
                    <span className="text-sm font-bold text-gray-900">{activeItem.category.name}</span>
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