"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/adminClient";
import {
  GripVertical,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Info,
  ArrowLeft,
  Layers,
} from "lucide-react";
import PageLoader from "@/app/(admin)/dashboard/components/PageLoader";

import {
  DndContext,
  type CollisionDetection,
  closestCenter,
  pointerWithin,
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

const getResponseMessage = async (res: Response, fallback: string) => {
  try {
    const data = await res.json();
    if (typeof data?.error === "string" && data.error.trim()) return data.error;
    if (typeof data?.message === "string" && data.message.trim()) return data.message;
  } catch {}
  return fallback;
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const reindexFeatured = (items: Featured[]) =>
  items.map((item, index) => ({
    ...item,
    index,
  }));

const collisionDetectionStrategy: CollisionDetection = (args) => {
  const pointerIntersections = pointerWithin(args);

  if (pointerIntersections.length > 0) {
    return pointerIntersections;
  }

  return closestCenter(args);
};

/* ─── Shared UI Component ────────────────────────────────────────── */
function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[28px] border border-white bg-white/80 backdrop-blur-xl shadow-[0_20px_50px_rgba(3,199,254,0.08)] ${className}`}>
      {children}
    </div>
  );
}

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
      className={`flex items-center justify-between gap-4 rounded-2xl border bg-white p-4 transition-all ${
        isDragging
          ? "scale-[1.02] border-[#03c7fe] opacity-90 shadow-2xl ring-2 ring-[#03c7fe]/20"
          : "border-[#cfeef7] shadow-sm hover:border-[#03c7fe]"
      }`}
    >
      <div className="flex items-center gap-4">
        {/* Order Badge */}
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f2fbff] text-xs font-black text-[#03c7fe]">
          {index + 1}
        </span>
        
        {/* Drag Handle */}
        <div
          ref={setActivatorNodeRef}
          {...listeners}
          {...attributes}
          className="cursor-grab text-[#aaa] transition-colors hover:text-[#03c7fe] active:cursor-grabbing"
        >
          <GripVertical size={20} />
        </div>

        {/* Info */}
        <div className="flex items-center gap-4 pl-2">
          <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-xl border border-[#cfeef7] bg-[#fbfdff] p-1">
            <img src={item.category.image || "/placeholder.png"} alt={item.category.name} className="h-full w-full rounded-lg object-cover" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-black text-[#111]">{item.category.name}</span>
            <span className="text-[10px] font-bold text-[#aaa]">/{item.category.slug}</span>
          </div>
        </div>
      </div>

      <button
        onClick={() => onRemove(item._id)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#aaa] transition-colors hover:bg-red-50 hover:text-red-500"
        title="Remove from featured"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
}

// --- Main Page Component ---
export default function FeaturedCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [featured, setFeatured] = useState<Featured[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
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
        adminFetch("/api/categories"),
        adminFetch("/api/featured-categories")
      ]);
      if (!catRes.ok) {
        throw new Error(await getResponseMessage(catRes, "Failed to load categories."));
      }
      if (!featRes.ok) {
        throw new Error(await getResponseMessage(featRes, "Failed to load featured categories."));
      }
      const catData = await catRes.json();
      const featData = await featRes.json();
      
      setCategories(catData.categories || []);
      setFeatured(
        reindexFeatured(
          ((featData.items || []) as Featured[]).sort((a, b) => a.index - b.index)
        )
      );
    } catch (error) {
      console.error("Fetch error", error);
      showToast(getErrorMessage(error, "Failed to load categories."), "error");
    } finally {
      setPageLoading(false);
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
      const res = await adminFetch("/api/featured-categories/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId }),
      });
      if (!res.ok) {
        throw new Error(
          await getResponseMessage(res, "Failed to add featured category.")
        );
      }
      await fetchInitialData();
      showToast("Category added to featured list.", "success");
    } catch (error) {
      showToast(getErrorMessage(error, "Error adding category."), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      const res = await adminFetch(`/api/featured-categories/${id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error(
          await getResponseMessage(res, "Failed to remove featured category.")
        );
      }
      setFeatured((prev) => reindexFeatured(prev.filter((f) => f._id !== id)));
      showToast("Category removed from featured.", "info");
    } catch (error) {
      showToast(getErrorMessage(error, "Failed to remove category."), "error");
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const oldIndex = featured.findIndex((f) => f._id === active.id);
    const newIndex = featured.findIndex((f) => f._id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const previousOrder = featured;
    const newOrder = reindexFeatured(arrayMove(featured, oldIndex, newIndex));
    
    setFeatured(newOrder);

    try {
      const movedItem = newOrder[newIndex];
      const res = await adminFetch(`/api/featured-categories/${movedItem._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index: newIndex }),
      });

      if (!res.ok) {
        throw new Error(
          await getResponseMessage(res, "Failed to save order")
        );
      }

      showToast("Order updated successfully.", "success");
    } catch (error) {
      console.error("Order save failed", error);
      setFeatured(previousOrder);
      showToast(getErrorMessage(error, "Failed to save new order."), "error");
    }
  };

  const activeItem = activeId ? featured.find(f => f._id === activeId) : null;

  if (pageLoading) {
    return <PageLoader icon={Layers} label="Loading Featured Categories..." />;
  }

  return (
    <main className="min-h-screen bg-[#f2fbff] px-4 py-8 md:px-8">
      
      {/* Toast Container */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 rounded-2xl px-5 py-3 text-xs font-black text-white shadow-[0_10px_25px_rgba(0,0,0,0.1)] transition-all animate-in slide-in-from-right-8 ${
              toast.type === "success"
                ? "bg-emerald-500"
                : toast.type === "error"
                ? "bg-red-500"
                : "bg-[#111]"
            }`}
          >
            {toast.type === "success" && <CheckCircle2 size={16} />}
            {toast.type === "error" && <AlertCircle size={16} />}
            {toast.type === "info" && <Info size={16} />}
            {toast.message}
          </div>
        ))}
      </div>

      {/* Header Panel */}
      <Panel className="mb-6 flex flex-col gap-6 p-7 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/categories"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#cfeef7] bg-white text-[#111] transition hover:border-[#03c7fe] hover:text-[#03c7fe]"
          >
            <ArrowLeft size={22} />
          </Link>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Web Management</p>
            <h1 className="text-2xl font-black text-[#111]">Featured Categories</h1>
          </div>
        </div>
        <div
          className={`flex items-center gap-3 rounded-2xl border px-5 py-3 ${
            featured.length >= 8
              ? "border-red-200 bg-[#fff5f5]"
              : "border-[#cfeef7] bg-white"
          }`}
        >
          <span className="text-[10px] font-black uppercase tracking-widest text-[#888]">Slots Filled:</span>
          <strong
            className={`text-lg font-black ${
              featured.length >= 8 ? "text-red-500" : "text-[#03c7fe]"
            }`}
          >
            {featured.length} / 8
          </strong>
        </div>
      </Panel>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        
        {/* LEFT: Available Categories Panel */}
        <Panel className="p-6">
          <h2 className="mb-5 flex items-center gap-2 border-b border-[#e0f4fb] pb-4 text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
            <Layers size={14} /> Available Categories
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {categories.map((cat) => {
              const active = isFeatured(cat._id);
              return (
                <div 
                  key={cat._id} 
                  className={`flex flex-col overflow-hidden rounded-2xl border bg-white transition-all ${
                    active 
                      ? "border-[#03c7fe] opacity-60 ring-1 ring-[#03c7fe]" 
                      : "border-[#cfeef7] hover:border-[#03c7fe]"
                  }`}
                >
                  <div className="flex h-24 w-full items-center justify-center border-b border-[#cfeef7] bg-[#fbfdff] p-4">
                    <img src={cat.image || "/placeholder.png"} alt={cat.name} className="h-full w-full rounded-lg object-cover" />
                  </div>
                  <div className="flex flex-col gap-3 p-4">
                    <h4 className="truncate text-xs font-black text-[#111]">{cat.name}</h4>
                    <button
                      disabled={active || featured.length >= 8 || loading}
                      onClick={() => handleAddFeatured(cat._id)}
                      className={`w-full rounded-xl py-2 text-[10px] font-black uppercase tracking-wider transition-colors disabled:cursor-not-allowed ${
                        active 
                          ? "bg-[#f2fbff] text-[#aaa]" 
                          : "bg-[#03c7fe] text-white hover:bg-[#02a9d8] shadow-[0_4px_14px_rgba(3,199,254,0.2)]"
                      }`}
                    >
                      {active ? "Selected" : "Add Category"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* RIGHT: Display Order Panel */}
        <Panel className="p-6 bg-[#fbfdff]">
          <h2 className="mb-5 flex items-center gap-2 border-b border-[#e0f4fb] pb-4 text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
            Homepage Display Order
          </h2>
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetectionStrategy}
            onDragStart={(e) => setActiveId(String(e.active.id))}
            onDragCancel={() => setActiveId(null)}
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
                  <div className="flex h-40 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#cfeef7] bg-white text-[#888]">
                    <p className="text-xs font-black uppercase tracking-widest text-[#aaa]">No featured categories yet</p>
                    <p className="mt-1 text-[10px] font-bold">Select categories from the left panel.</p>
                  </div>
                )}
              </div>
            </SortableContext>

            {/* Dragging Overlay Clone */}
            <DragOverlay>
              {activeItem ? (
                <div className="flex items-center gap-4 rounded-2xl border-2 border-[#03c7fe] bg-white p-4 shadow-2xl opacity-90">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f2fbff] text-xs font-black text-[#03c7fe]">
                    {featured.findIndex((item) => item._id === activeItem._id) + 1}
                  </span>
                  <GripVertical size={20} className="text-[#03c7fe]" />
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-xl border border-[#cfeef7] bg-[#fbfdff] p-1">
                      <img src={activeItem.category.image || "/placeholder.png"} alt="" className="h-full w-full rounded-lg object-cover" />
                    </div>
                    <span className="text-sm font-black text-[#111]">{activeItem.category.name}</span>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </Panel>

      </div>
    </main>
  );
}
