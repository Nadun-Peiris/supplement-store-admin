"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { adminFetch } from "@/lib/adminClient";
import { uploadToCloudinary } from "@/lib/uploadToCloudinary";
import { ArrowLeft, ArrowRight, ImagePlus, Edit2, Trash2, Plus, Search, X, Layers, Star } from "lucide-react";
import ConfirmDialog from "@/app/(admin)/dashboard/components/ConfirmDialog";
import PageLoader from "@/app/(admin)/dashboard/components/PageLoader";
import ToastStack, { type DashboardToast } from "@/app/(admin)/dashboard/components/ToastStack";

type Category = {
  _id: string;
  name: string;
  slug: string;
  image: string;
};

/* ─── Shared UI Component ────────────────────────────────────────── */
function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[28px] border border-white bg-white/80 backdrop-blur-xl shadow-[0_20px_50px_rgba(3,199,254,0.08)] ${className}`}>
      {children}
    </div>
  );
}

const ITEMS_PER_PAGE = 20;
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

type ConfirmState =
  | {
      title: string;
      message: string;
      confirmText: string;
      isDanger?: boolean;
      action: () => Promise<void> | void;
    }
  | null;

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [toasts, setToasts] = useState<DashboardToast[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [isConfirmLoading, setIsConfirmLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (
    message: string,
    type: DashboardToast["type"] = "info"
  ) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3000);
  };

  const fetchCategories = async () => {
    try {
      const res = await adminFetch("/api/categories");
      const data = await res.json();
      const nextCategories = data.categories || [];
      setCategories(nextCategories);
      setSelectedCategoryIds((prev) =>
        prev.filter((id) => nextCategories.some((category: Category) => category._id === id))
      );
    } catch (error) {
      console.error("Failed to fetch categories", error);
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // Filter Categories
  const filteredCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return categories;
    return categories.filter((cat) =>
      cat.name.toLowerCase().includes(query) ||
      cat.slug.toLowerCase().includes(query)
    );
  }, [categories, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / ITEMS_PER_PAGE));

  const paginatedCategories = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCategories.slice(start, start + ITEMS_PER_PAGE);
  }, [currentPage, filteredCategories]);

  const currentPageCategoryIds = useMemo(
    () => paginatedCategories.map((category) => category._id),
    [paginatedCategories]
  );

  const allVisibleSelected =
    currentPageCategoryIds.length > 0 &&
    currentPageCategoryIds.every((id) => selectedCategoryIds.includes(id));

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      showToast("Category name is required.", "error");
      return;
    }
    setLoading(true);

    try {
      let imageUrl = preview;
      if (file) {
        imageUrl = await uploadToCloudinary(file);
      }
      if (!imageUrl) {
        showToast("Category image is required.", "error");
        setLoading(false);
        return;
      }

      const payload = { name, image: imageUrl };
      const url = editingId ? `/api/categories/${editingId}` : "/api/categories";
      const method = editingId ? "PUT" : "POST";

      const res = await adminFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(
          await getResponseMessage(
            res,
            editingId ? "Failed to update category." : "Failed to create category."
          )
        );
      }

      closeModal();
      await fetchCategories();
      showToast(
        editingId
          ? `Category "${name}" updated successfully.`
          : `Category "${name}" created successfully.`,
        "success"
      );
    } catch (error) {
      showToast(getErrorMessage(error, "Failed to save category."), "error");
    } finally {
      setLoading(false);
    }
  };

  const deleteCategories = async (ids: string[], label?: string) => {
    if (ids.length === 0) return;
    setDeleteLoading(true);
    try {
      const responses = await Promise.all(
        ids.map((id) => adminFetch(`/api/categories/${id}`, { method: "DELETE" }))
      );

      const failedResponse = responses.find((res) => !res.ok);
      if (failedResponse) {
        throw new Error(
          await getResponseMessage(
            failedResponse,
            ids.length === 1 ? "Failed to delete category." : "Failed to delete selected categories."
          )
        );
      }

      setSelectedCategoryIds((prev) => prev.filter((id) => !ids.includes(id)));
      await fetchCategories();
      showToast(
        ids.length === 1 && label
          ? `Category "${label}" deleted successfully.`
          : `${ids.length} categor${ids.length === 1 ? "y" : "ies"} deleted successfully.`,
        "success"
      );
    } catch (error) {
      showToast(getErrorMessage(error, "Failed to delete category."), "error");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDelete = async (id: string, categoryName: string) => {
    setConfirmState({
      title: "Delete category?",
      message: `Delete "${categoryName}"? This action cannot be undone.`,
      confirmText: "Delete",
      isDanger: true,
      action: () => deleteCategories([id], categoryName),
    });
  };

  const handleBulkDelete = async () => {
    if (selectedCategoryIds.length === 0) return;
    setConfirmState({
      title: "Delete selected categories?",
      message: `Delete ${selectedCategoryIds.length} selected categor${
        selectedCategoryIds.length === 1 ? "y" : "ies"
      }? This action cannot be undone.`,
      confirmText: "Delete",
      isDanger: true,
      action: () => deleteCategories(selectedCategoryIds),
    });
  };

  const toggleCategorySelection = (id: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  };

  const handleSelectAllCategories = () => {
    setSelectedCategoryIds((prev) =>
      allVisibleSelected
        ? prev.filter((id) => !currentPageCategoryIds.includes(id))
        : Array.from(new Set([...prev, ...currentPageCategoryIds]))
    );
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleEdit = (cat: Category) => {
    setEditingId(cat._id);
    setName(cat.name ?? "");
    setPreview(cat.image);
    setFile(null);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  if (pageLoading) {
    return <PageLoader icon={Layers} label="Loading Categories..." />;
  }

  return (
    <main className="min-h-screen bg-[#f2fbff] px-4 py-8 md:px-8">
      <ToastStack toasts={toasts} />
      {/* Page Header Panel */}
      <Panel className="mb-6 flex flex-col gap-6 p-7 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#03c7fe] text-white shadow-[0_8px_20px_rgba(3,199,254,0.3)]">
            <Layers size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Taxonomy Management</p>
            <h1 className="text-2xl font-black text-[#111]">Categories</h1>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/dashboard/categories/featured-categories"
            className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-[#cfeef7] bg-white px-5 py-3 text-xs font-black text-[#03c7fe] transition hover:border-[#03c7fe]"
          >
            <Star size={14} /> Featured
          </Link>
          <div className="relative w-full sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aaa]" />
            <input
              type="text"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-[#cfeef7] bg-white py-3 pl-10 pr-4 text-xs font-bold text-[#111] outline-none transition focus:border-[#03c7fe] focus:ring-2 focus:ring-[#03c7fe]/20"
            />
          </div>
          <button
            onClick={openCreateModal}
            className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-[#03c7fe] px-5 py-3 text-xs font-black text-white shadow-[0_10px_25px_rgba(3,199,254,0.3)] transition hover:scale-[1.02]"
          >
            <Plus size={14} /> Add Category
          </button>
        </div>
      </Panel>

      {/* Data Table Panel */}
      <Panel className="p-6">
        <div className="mb-4 flex items-center justify-between border-b border-[#e0f4fb] pb-4">
          <div className="flex gap-4">
            <button
              onClick={handleSelectAllCategories}
              className="text-[10px] font-black uppercase text-[#03c7fe] hover:underline"
            >
              {allVisibleSelected ? "Clear Selection" : "Select Page"}
            </button>
            {selectedCategoryIds.length > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={deleteLoading}
                className="text-[10px] font-black uppercase text-red-500 hover:underline disabled:opacity-50"
              >
                {deleteLoading ? "Deleting..." : `Delete Selected (${selectedCategoryIds.length})`}
              </button>
            )}
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#aaa]">
            {filteredCategories.length} total categories
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse">
            <thead>
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
                  Selection
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
                  Cover Image
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
                  Category Name
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
                  Slug Path
                </th>
                <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedCategories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-sm font-bold text-[#aaa]">
                    No categories found matching your criteria.
                  </td>
                </tr>
              ) : (
                paginatedCategories.map((cat) => (
                  <tr key={cat._id} className="border-t border-[#e0f4fb] transition hover:bg-[#f2fbff]">
                    <td className="whitespace-nowrap px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedCategoryIds.includes(cat._id)}
                        onChange={() => toggleCategorySelection(cat._id)}
                        className="accent-[#03c7fe]"
                      />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <img
                        src={cat.image || "/placeholder.png"}
                        alt={cat.name}
                        className="h-10 w-16 rounded-lg border border-[#cfeef7] object-cover bg-white"
                      />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-black text-[#111]">
                      {cat.name}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-xs font-bold text-[#aaa]">
                      /{cat.slug}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => handleEdit(cat)}
                          className="rounded-full p-2 text-[#aaa] transition-colors hover:bg-[#f2fbff] hover:text-[#03c7fe]"
                          title="Edit Category"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(cat._id, cat.name)}
                          className="rounded-full p-2 text-[#aaa] transition-colors hover:bg-red-50 hover:text-red-500"
                          title="Delete Category"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredCategories.length > 0 && (
          <div className="mt-6 flex items-center justify-between border-t border-[#e0f4fb] pt-4">
            <p className="text-[10px] font-black text-[#aaa]">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="rounded-full bg-[#f2fbff] p-2 text-[#03c7fe] transition hover:bg-[#e0f4fb] disabled:opacity-50"
              >
                <ArrowLeft size={16} />
              </button>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="rounded-full bg-[#f2fbff] p-2 text-[#03c7fe] transition hover:bg-[#e0f4fb] disabled:opacity-50"
              >
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}
      </Panel>

      {/* Modal Overlay for Add/Edit Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#111]/20 p-4 backdrop-blur-sm">
          <Panel className="flex w-full max-w-md flex-col overflow-hidden p-0">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#cfeef7] bg-[#fbfdff] px-6 py-5">
              <h3 className="text-lg font-black text-[#111]">
                {editingId ? "Edit Category" : "New Category"}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full p-2 text-[#aaa] transition-colors hover:bg-[#f2fbff] hover:text-[#111]"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="flex flex-col bg-white">
              <div className="flex flex-col gap-5 p-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Category Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Electronics"
                    required
                    className="w-full rounded-2xl border border-[#cfeef7] bg-white px-4 py-3 text-sm font-bold text-[#111] outline-none transition-colors focus:border-[#03c7fe] focus:ring-2 focus:ring-[#03c7fe]/20"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Cover Image</label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="group relative flex h-40 w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-[#cfeef7] bg-[#fbfdff] transition-colors hover:border-[#03c7fe]"
                  >
                    {preview ? (
                      <img
                        src={preview}
                        alt="Preview"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-[#aaa] group-hover:text-[#03c7fe]">
                        <ImagePlus size={32} />
                        <span className="text-xs font-bold">Click to upload image</span>
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
              </div>

              {/* Modal Footer Actions */}
              <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[#cfeef7] bg-[#fbfdff] px-6 py-5">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-2xl border border-[#cfeef7] bg-white px-5 py-3 text-xs font-black text-[#111] transition hover:bg-[#f2fbff]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-2xl bg-[#03c7fe] px-5 py-3 text-xs font-black text-white shadow-[0_10px_25px_rgba(3,199,254,0.3)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Processing..." : editingId ? "Update Category" : "Create Category"}
                </button>
              </div>
            </form>
          </Panel>
        </div>
      )}
      {confirmState && (
        <ConfirmDialog
          title={confirmState.title}
          message={confirmState.message}
          confirmText={confirmState.confirmText}
          isDanger={confirmState.isDanger}
          isLoading={isConfirmLoading}
          onCancel={() => setConfirmState(null)}
          onConfirm={async () => {
            setIsConfirmLoading(true);
            try {
              await confirmState.action();
              setConfirmState(null);
            } finally {
              setIsConfirmLoading(false);
            }
          }}
        />
      )}
    </main>
  );
}
