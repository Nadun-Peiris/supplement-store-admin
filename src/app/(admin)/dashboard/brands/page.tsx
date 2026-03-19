"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { uploadToCloudinary } from "@/lib/uploadToCloudinary";
import { ArrowLeft, ArrowRight, CheckSquare, ImagePlus, Edit2, Trash2, Plus, Search, X } from "lucide-react";

type Brand = {
  _id: string;
  name: string;
  slug: string;
  image?: string;
};

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

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchBrands = async () => {
    try {
      const res = await fetch("/api/brands");
      const data = await res.json();
      const nextBrands = data.brands || [];
      setBrands(nextBrands);
      setSelectedBrandIds((prev) =>
        prev.filter((id) => nextBrands.some((brand: Brand) => brand._id === id))
      );
    } catch (error) {
      console.error("Failed to fetch brands", error);
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

      const res = await fetch(url, {
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
          fetch(`/api/brands/${id}`, {
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

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-gray-900">Brands</h1>
            <p className="text-sm text-gray-500 sm:hidden">Manage your product brands and logos.</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search brands..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 outline-none transition-colors focus:border-[#01C7FE] focus:ring-1 focus:ring-[#01C7FE]"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSelectAllBrands}
            disabled={currentPageBrandIds.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckSquare size={16} />
            {allVisibleSelected ? "Clear Selection" : "Select All"}
          </button>
          <Link
            href="/dashboard/webmanagement/featured-brands"
            className="inline-flex items-center justify-center rounded-lg border border-[#01C7FE] px-4 py-2 text-sm font-semibold text-[#01C7FE] shadow-sm transition-colors hover:bg-[#01C7FE]/10"
          >
            Featured Brands
          </Link>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#01C7FE] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#00b3e6]"
          >
            <Plus size={18} />
            Add Brand
          </button>
        </div>
      </header>

      {/* Data Table */}
      <main className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500">
            {selectedBrandIds.length > 0
              ? `${selectedBrandIds.length} selected`
              : `${filteredBrands.length} brand${filteredBrands.length === 1 ? "" : "s"} found`}
          </p>
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={selectedBrandIds.length === 0 || deleteLoading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 size={16} />
            {deleteLoading ? "Deleting..." : "Delete Selected"}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={handleSelectAllBrands}
                    disabled={currentPageBrandIds.length === 0}
                    className="h-4 w-4 rounded border-gray-300 text-[#01C7FE] focus:ring-[#01C7FE]"
                    aria-label="Select all brands"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Brand Logo
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Brand Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Slug Path
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {paginatedBrands.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-gray-500">
                    No brands found.
                  </td>
                </tr>
              ) : (
                paginatedBrands.map((brand) => (
                  <tr key={brand._id} className="transition-colors hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedBrandIds.includes(brand._id)}
                        onChange={() => toggleBrandSelection(brand._id)}
                        className="h-4 w-4 rounded border-gray-300 text-[#01C7FE] focus:ring-[#01C7FE]"
                        aria-label={`Select ${brand.name}`}
                      />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {/* Logo Container: using flex & object-contain so logos fit nicely */}
                      <div className="flex h-12 w-20 items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-gray-50 p-1">
                        <img
                          src={brand.image || "/placeholder.png"}
                          alt={brand.name}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-bold text-gray-900">
                      {brand.name}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <code className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">
                        /{brand.slug}
                      </code>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => handleEdit(brand)}
                          className="text-gray-400 transition-colors hover:text-[#01C7FE]"
                          title="Edit Brand"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(brand._id)}
                          className="text-gray-400 transition-colors hover:text-red-600"
                          title="Delete Brand"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filteredBrands.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-gray-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredBrands.length)} of {filteredBrands.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ArrowLeft size={16} />
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Modal Overlay for Add/Edit Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-sm sm:p-6">
          <div className="flex w-full max-w-md flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900">
                {editingId ? "Edit Brand" : "New Brand"}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="flex flex-col">
              <div className="flex flex-col gap-5 p-6">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Brand Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Optimum Nutrition"
                    required
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-[#01C7FE] focus:bg-white focus:ring-1 focus:ring-[#01C7FE]"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Brand Logo (Optional)</label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="group relative flex h-40 w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4 transition-colors hover:border-[#01C7FE] hover:bg-white"
                  >
                    {preview ? (
                      <img
                        src={preview}
                        alt="Preview"
                        className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-gray-400 group-hover:text-[#01C7FE]">
                        <ImagePlus size={32} />
                        <span className="text-sm font-medium">Click to upload logo</span>
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
              <div className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-[#01C7FE] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#00b3e6] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Processing..." : editingId ? "Update Brand" : "Create Brand"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
