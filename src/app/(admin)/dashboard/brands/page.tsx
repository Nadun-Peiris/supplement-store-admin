"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { adminFetch } from "@/lib/adminClient";
import { uploadToCloudinary } from "@/lib/uploadToCloudinary";
import { ArrowLeft, ArrowRight, ImagePlus, Edit2, Trash2, Plus, Search, X, Tag, Star } from "lucide-react";
import PageLoader from "@/app/(admin)/dashboard/components/PageLoader";

type Brand = {
  _id: string;
  name: string;
  slug: string;
  image?: string;
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

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);
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

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchBrands = async () => {
    try {
      const res = await adminFetch("/api/brands");
      const data = await res.json();
      const nextBrands = data.brands || [];
      setBrands(nextBrands);
      setSelectedBrandIds((prev) =>
        prev.filter((id) => nextBrands.some((brand: Brand) => brand._id === id))
      );
    } catch (error) {
      console.error("Failed to fetch brands", error);
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => {
    fetchBrands();
  }, []);

  // Filter Brands
  const filteredBrands = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return brands;
    return brands.filter((brand) =>
      brand.name.toLowerCase().includes(query) ||
      brand.slug.toLowerCase().includes(query)
    );
  }, [brands, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredBrands.length / ITEMS_PER_PAGE));

  const paginatedBrands = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredBrands.slice(start, start + ITEMS_PER_PAGE);
  }, [currentPage, filteredBrands]);

  const currentPageBrandIds = useMemo(
    () => paginatedBrands.map((brand) => brand._id),
    [paginatedBrands]
  );

  const allVisibleSelected =
    currentPageBrandIds.length > 0 &&
    currentPageBrandIds.every((id) => selectedBrandIds.includes(id));

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
    if (!name) return alert("Brand name required");

    setLoading(true);

    try {
      let imageUrl = preview;

      if (file) {
        imageUrl = await uploadToCloudinary(file);
      }

      const payload = { name, image: imageUrl };

      const url = editingId ? `/api/brands/${editingId}` : "/api/brands";
      const method = editingId ? "PUT" : "POST";

      const res = await adminFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save");

      closeModal();
      fetchBrands();
    } catch {
      alert("Operation failed");
    } finally {
      setLoading(false);
    }
  };

  const deleteBrands = async (ids: string[]) => {
    if (ids.length === 0) return;
    setDeleteLoading(true);

    try {
      const responses = await Promise.all(
        ids.map((id) =>
          adminFetch(`/api/brands/${id}`, {
            method: "DELETE",
          })
        )
      );

      if (responses.some((res) => !res.ok)) {
        throw new Error("Failed to delete some brands");
      }

      setSelectedBrandIds((prev) => prev.filter((id) => !ids.includes(id)));
      await fetchBrands();
    } catch {
      alert("Failed to delete brand");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure? This action cannot be undone.")) return;
    await deleteBrands([id]);
  };

  const handleBulkDelete = async () => {
    if (selectedBrandIds.length === 0) return;
    if (
      !confirm(
        `Delete ${selectedBrandIds.length} selected brand${
          selectedBrandIds.length === 1 ? "" : "s"
        }? This action cannot be undone.`
      )
    ) {
      return;
    }

    await deleteBrands(selectedBrandIds);
  };

  const toggleBrandSelection = (id: string) => {
    setSelectedBrandIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  };

  const handleSelectAllBrands = () => {
    setSelectedBrandIds((prev) =>
      allVisibleSelected
        ? prev.filter((id) => !currentPageBrandIds.includes(id))
        : Array.from(new Set([...prev, ...currentPageBrandIds]))
    );
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleEdit = (brand: Brand) => {
    setEditingId(brand._id);
    setName(brand.name ?? "");
    setPreview(brand.image || null);
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
    return <PageLoader icon={Tag} label="Loading Brands..." />;
  }

  return (
    <main className="min-h-screen bg-[#f2fbff] px-4 py-8 md:px-8">
      {/* Page Header Panel */}
      <Panel className="mb-6 flex flex-col gap-6 p-7 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#03c7fe] text-white shadow-[0_8px_20px_rgba(3,199,254,0.3)]">
            <Tag size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">System Management</p>
            <h1 className="text-2xl font-black text-[#111]">Brands</h1>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/dashboard/brands/featured-brands"
            className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-[#cfeef7] bg-white px-5 py-3 text-xs font-black text-[#03c7fe] transition hover:border-[#03c7fe]"
          >
            <Star size={14} /> Featured
          </Link>
          <div className="relative w-full sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aaa]" />
            <input
              type="text"
              placeholder="Search brands..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-[#cfeef7] bg-white py-3 pl-10 pr-4 text-xs font-bold text-[#111] outline-none transition focus:border-[#03c7fe] focus:ring-2 focus:ring-[#03c7fe]/20"
            />
          </div>
          <button
            onClick={openCreateModal}
            className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-[#03c7fe] px-5 py-3 text-xs font-black text-white shadow-[0_10px_25px_rgba(3,199,254,0.3)] transition hover:scale-[1.02]"
          >
            <Plus size={14} /> Add Brand
          </button>
        </div>
      </Panel>

      {/* Data Table Panel */}
      <Panel className="p-6">
        <div className="mb-4 flex items-center justify-between border-b border-[#e0f4fb] pb-4">
          <div className="flex gap-4">
            <button
              onClick={handleSelectAllBrands}
              className="text-[10px] font-black uppercase text-[#03c7fe] hover:underline"
            >
              {allVisibleSelected ? "Clear Selection" : "Select Page"}
            </button>
            {selectedBrandIds.length > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={deleteLoading}
                className="text-[10px] font-black uppercase text-red-500 hover:underline disabled:opacity-50"
              >
                {deleteLoading ? "Deleting..." : `Delete Selected (${selectedBrandIds.length})`}
              </button>
            )}
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#aaa]">
            {filteredBrands.length} total brands
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
                  Logo
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
                  Name
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
                  Slug
                </th>
                <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedBrands.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-sm font-bold text-[#aaa]">
                    No brands found matching your criteria.
                  </td>
                </tr>
              ) : (
                paginatedBrands.map((brand) => (
                  <tr key={brand._id} className="border-t border-[#e0f4fb] transition hover:bg-[#f2fbff]">
                    <td className="whitespace-nowrap px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedBrandIds.includes(brand._id)}
                        onChange={() => toggleBrandSelection(brand._id)}
                        className="accent-[#03c7fe]"
                      />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <img
                        src={brand.image || "/placeholder.png"}
                        alt={brand.name}
                        className="h-10 w-16 rounded-lg border border-[#cfeef7] object-contain p-1 bg-white"
                      />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-black text-[#111]">
                      {brand.name}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-xs font-bold text-[#aaa]">
                      /{brand.slug}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => handleEdit(brand)}
                          className="text-[#aaa] transition hover:text-[#03c7fe]"
                          title="Edit Brand"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(brand._id)}
                          className="text-[#aaa] transition hover:text-red-500"
                          title="Delete Brand"
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
        {filteredBrands.length > 0 && (
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
          <Panel className="flex w-full max-w-sm flex-col overflow-hidden p-0">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#cfeef7] bg-[#fbfdff] px-6 py-5">
              <h3 className="text-lg font-black text-[#111]">
                {editingId ? "Edit Brand" : "New Brand"}
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
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Brand Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Optimum Nutrition"
                    required
                    className="w-full rounded-2xl border border-[#cfeef7] bg-white px-4 py-3 text-sm font-bold text-[#111] outline-none transition-colors focus:border-[#03c7fe] focus:ring-2 focus:ring-[#03c7fe]/20"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Brand Logo (Optional)</label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="group relative flex h-40 w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-[#cfeef7] bg-[#fbfdff] transition-colors hover:border-[#03c7fe]"
                  >
                    {preview ? (
                      <img
                        src={preview}
                        alt="Preview"
                        className="h-full w-full object-contain p-2"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-[#aaa] group-hover:text-[#03c7fe]">
                        <ImagePlus size={32} />
                        <span className="text-xs font-bold">Click to upload logo</span>
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
                  {loading ? "Processing..." : editingId ? "Update Brand" : "Create Brand"}
                </button>
              </div>
            </form>
          </Panel>
        </div>
      )}
    </main>
  );
}
