"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { uploadToCloudinary } from "@/lib/uploadToCloudinary";
import { ArrowLeft, ArrowRight, CheckSquare, Edit2, Plus, Search, Trash2, X, Minus } from "lucide-react";

// --- Types ---
type Nutrient = {
  name: string;
  amount: string;
  dailyValue: string;
  indentLevel: number;
  emphasized: boolean;
};

type Product = {
  _id: string;
  name: string;
  slug: string;
  category: string;
  categorySlug?: string;
  brandName: string;
  brandSlug?: string;
  price: number;
  discountPrice?: number;
  currency: string;
  stock: number;
  image: string;
  hoverImage?: string;
  gallery?: string[];
  description?: string;
  isActive: boolean;
  details?: {
    overview?: string;
    ingredients?: string[];
    benefits?: string[];
    howToUse?: string[];
    warnings?: string[];
    additionalInfo?: string[];
    servingInfo?: {
      servingSize?: string;
      servingsPerContainer?: number;
      nutrients?: Nutrient[];
      title?: string;
      amountPerServingLabel?: string;
      dailyValueLabel?: string;
      footnote?: string;
      ingredientsText?: string;
      containsText?: string;
      noticeText?: string;
    };
  };
  coa?: {
    certificateUrl?: string;
    verified?: boolean;
  };
};

type Category = { _id: string; name: string };
type Brand = { _id: string; name: string };

// Flattened form state for easier handling of standard inputs
type ProductFormState = {
  name: string;
  category: string;
  brandName: string;
  price: string;
  discountPrice: string;
  currency: string;
  stock: string;
  image: string;
  hoverImage: string;
  gallery: string;
  description: string;
  overview: string;
  ingredients: string;
  benefits: string;
  howToUse: string;
  warnings: string;
  additionalInfo: string;
  nutritionTitle: string;
  amountPerServingLabel: string;
  dailyValueLabel: string;
  servingSize: string;
  servingsPerContainer: string;
  nutritionFootnote: string;
  nutritionIngredientsText: string;
  nutritionContainsText: string;
  nutritionNoticeText: string;
  nutritionFactsText: string;
  certificateUrl: string;
  verified: boolean;
  isActive: boolean;
};

const slugifyPreview = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const splitCommaSeparated = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const defaultNutritionLabels = {
  title: "Nutrition Facts",
  amountPerServingLabel: "Amount Per Serving",
  dailyValueLabel: "% Daily Value",
};

const emptyNutrient = (): Nutrient => ({
  name: "",
  amount: "",
  dailyValue: "",
  indentLevel: 0,
  emphasized: false,
});

const parseNutritionFactsText = (value: string) => {
  const rawLines = value
    .split("\n")
    .map((line) => line.replace(/\r/g, ""))
    .filter((line) => line.trim());

  const result = {
    title: defaultNutritionLabels.title,
    amountPerServingLabel: defaultNutritionLabels.amountPerServingLabel,
    dailyValueLabel: defaultNutritionLabels.dailyValueLabel,
    servingSize: "",
    footnote: "",
    ingredientsText: "",
    containsText: "",
    noticeText: "",
    nutrients: [] as Nutrient[],
  };

  const collectSectionText = (startIndex: number) => {
    const lines: string[] = [];
    let index = startIndex;
    while (index < rawLines.length) {
      const line = rawLines[index].trim();
      if (/^(Contains|Notice):/i.test(line)) break;
      lines.push(line);
      index += 1;
    }
    return { text: lines.join(" "), nextIndex: index };
  };

  for (let index = 0; index < rawLines.length; index += 1) {
    const rawLine = rawLines[index];
    const line = rawLine.trim();

    if (/^Nutrition Facts$/i.test(line)) {
      result.title = line;
      continue;
    }

    if (/^Serving Size:/i.test(line)) {
      result.servingSize = line.replace(/^Serving Size:\s*/i, "").trim();
      continue;
    }

    if (/^Amount Per Serving/i.test(line)) {
      result.amountPerServingLabel = "Amount Per Serving";
      if (/%\s*Daily Value/i.test(line)) {
        result.dailyValueLabel = "% Daily Value";
      }
      continue;
    }

    if (/^The % Daily Value/i.test(line)) {
      result.footnote = line;
      continue;
    }

    if (/^Ingredients:/i.test(line)) {
      const section = collectSectionText(index);
      result.ingredientsText = section.text.replace(/^Ingredients:\s*/i, "").trim();
      index = section.nextIndex - 1;
      continue;
    }

    if (/^Contains:/i.test(line)) {
      result.containsText = line.replace(/^Contains:\s*/i, "").trim();
      continue;
    }

    if (/^Notice:/i.test(line)) {
      result.noticeText = line.replace(/^Notice:\s*/i, "").trim();
      continue;
    }

    if (/%\s*Daily Value/i.test(line)) {
      result.dailyValueLabel = "% Daily Value";
      continue;
    }

    const normalized = rawLine.replace(/\t/g, "    ");
    const columns = normalized.split(/\s{2,}/).map((part) => part.trim()).filter(Boolean);

    if (columns.length >= 2) {
      const indentLevel = /^\s+/.test(rawLine) ? 1 : 0;
      result.nutrients.push({
        name: columns[0],
        amount: columns[1] || "",
        dailyValue: columns[2] || "",
        indentLevel,
        emphasized: indentLevel === 0,
      });
    }
  }

  return result;
};

const initialForm: ProductFormState = {
  name: "",
  category: "",
  brandName: "",
  price: "",
  discountPrice: "",
  currency: "LKR",
  stock: "0",
  image: "",
  hoverImage: "",
  gallery: "",
  description: "",
  overview: "",
  ingredients: "",
  benefits: "",
  howToUse: "",
  warnings: "",
  additionalInfo: "",
  nutritionTitle: defaultNutritionLabels.title,
  amountPerServingLabel: defaultNutritionLabels.amountPerServingLabel,
  dailyValueLabel: defaultNutritionLabels.dailyValueLabel,
  servingSize: "",
  servingsPerContainer: "",
  nutritionFootnote: "",
  nutritionIngredientsText: "",
  nutritionContainsText: "",
  nutritionNoticeText: "",
  nutritionFactsText: "",
  certificateUrl: "",
  verified: false,
  isActive: true,
};

const ITEMS_PER_PAGE = 20;

// 🔥 The Tailwind fix for the TypeScript error
const inputClass = "w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-[#01C7FE] focus:bg-white focus:ring-1 focus:ring-[#01C7FE]";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  const [form, setForm] = useState<ProductFormState>(initialForm);
  const [nutrients, setNutrients] = useState<Nutrient[]>([]);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [mainImageFile, setMainImageFile] = useState<File | null>(null);
  const [hoverImageFile, setHoverImageFile] = useState<File | null>(null);

  const mainFileInputRef = useRef<HTMLInputElement>(null);
  const hoverFileInputRef = useRef<HTMLInputElement>(null);

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/products");
      const data = (await res.json()) as { products?: Product[] };
      const nextProducts = data.products || [];
      setProducts(nextProducts);
      setSelectedProductIds((prev) =>
        prev.filter((id) => nextProducts.some((product) => product._id === id))
      );
    } catch (error) {
      console.error("Failed to fetch products", error);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories");
      const data = (await res.json()) as { categories?: Category[] };
      setCategories(data.categories || []);
    } catch (error) {
      console.error("Failed to fetch categories", error);
    }
  };

  const fetchBrands = async () => {
    try {
      const res = await fetch("/api/brands");
      const data = (await res.json()) as { brands?: Brand[] };
      setBrands(data.brands || []);
    } catch (error) {
      console.error("Failed to fetch brands", error);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchBrands();
  }, []);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return products;
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.brandName?.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query)
    );
  }, [products, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE));

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(start, start + ITEMS_PER_PAGE);
  }, [currentPage, filteredProducts]);

  const currentPageProductIds = useMemo(
    () => paginatedProducts.map((product) => product._id),
    [paginatedProducts]
  );

  const allVisibleSelected =
    currentPageProductIds.length > 0 &&
    currentPageProductIds.every((id) => selectedProductIds.includes(id));

  const generatedProductSlug = useMemo(
    () => slugifyPreview(form.name),
    [form.name]
  );

  const generatedCategorySlug = useMemo(
    () => slugifyPreview(form.category),
    [form.category]
  );

  const generatedBrandSlug = useMemo(
    () => slugifyPreview(form.brandName),
    [form.brandName]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const resetForm = () => {
    setForm(initialForm);
    setNutrients([]);
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
      discountPrice: product.discountPrice ? String(product.discountPrice) : "",
      currency: product.currency || "LKR",
      stock: String(product.stock ?? 0),
      image: product.image,
      hoverImage: product.hoverImage || "",
      gallery: product.gallery?.join(", ") || "",
      description: product.description || "",
      overview: product.details?.overview || "",
      ingredients: product.details?.ingredients?.join(", ") || "",
      benefits: product.details?.benefits?.join(", ") || "",
      howToUse: product.details?.howToUse?.join(", ") || "",
      warnings: product.details?.warnings?.join(", ") || "",
      additionalInfo: product.details?.additionalInfo?.join(", ") || "",
      nutritionTitle: product.details?.servingInfo?.title || defaultNutritionLabels.title,
      amountPerServingLabel: product.details?.servingInfo?.amountPerServingLabel || defaultNutritionLabels.amountPerServingLabel,
      dailyValueLabel: product.details?.servingInfo?.dailyValueLabel || defaultNutritionLabels.dailyValueLabel,
      servingSize: product.details?.servingInfo?.servingSize || "",
      servingsPerContainer: product.details?.servingInfo?.servingsPerContainer ? String(product.details.servingInfo.servingsPerContainer) : "",
      nutritionFootnote: product.details?.servingInfo?.footnote || "",
      nutritionIngredientsText: product.details?.servingInfo?.ingredientsText || "",
      nutritionContainsText: product.details?.servingInfo?.containsText || "",
      nutritionNoticeText: product.details?.servingInfo?.noticeText || "",
      nutritionFactsText: "",
      certificateUrl: product.coa?.certificateUrl || "",
      verified: product.coa?.verified || false,
      isActive: product.isActive,
    });
    setNutrients(
      product.details?.servingInfo?.nutrients?.map((nutrient) => ({
        name: nutrient.name || "",
        amount: nutrient.amount || "",
        dailyValue: nutrient.dailyValue || "",
        indentLevel: nutrient.indentLevel ?? 0,
        emphasized: nutrient.emphasized ?? false,
      })) || []
    );
    setMainImageFile(null);
    setHoverImageFile(null);
    setIsModalOpen(true);
  };

  const addNutrientField = () => {
    setNutrients([...nutrients, emptyNutrient()]);
  };

  const updateNutrient = <K extends keyof Nutrient>(
    index: number,
    field: K,
    value: Nutrient[K]
  ) => {
    const updated = [...nutrients];
    updated[index][field] = value;
    setNutrients(updated);
  };

  const removeNutrientField = (index: number) => {
    setNutrients(nutrients.filter((_, i) => i !== index));
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

  const deleteProducts = async (ids: string[]) => {
    if (ids.length === 0) return;
    setDeleteLoading(true);
    try {
      const responses = await Promise.all(
        ids.map((id) => fetch(`/api/products/${id}`, { method: "DELETE" }))
      );
      if (responses.some((res) => !res.ok)) throw new Error("Failed to delete some products");
      setSelectedProductIds((prev) => prev.filter((id) => !ids.includes(id)));
      await fetchProducts();
    } catch {
      alert("Failed to delete product");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure? This action cannot be undone.")) return;
    await deleteProducts([id]);
  };

  const handleBulkDelete = async () => {
    if (selectedProductIds.length === 0) return;
    if (!confirm(`Delete ${selectedProductIds.length} selected product(s)?`)) return;
    await deleteProducts(selectedProductIds);
  };

  const toggleProductSelection = (id: string) => {
    setSelectedProductIds((prev) => prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]);
  };

  const handleSelectAllProducts = () => {
    setSelectedProductIds((prev) =>
      allVisibleSelected
        ? prev.filter((id) => !currentPageProductIds.includes(id))
        : Array.from(new Set([...prev, ...currentPageProductIds]))
    );
  };

  const handleParseNutritionFacts = () => {
    if (!form.nutritionFactsText.trim()) return;

    const parsed = parseNutritionFactsText(form.nutritionFactsText);
    setForm((prev) => ({
      ...prev,
      nutritionTitle: parsed.title,
      amountPerServingLabel: parsed.amountPerServingLabel,
      dailyValueLabel: parsed.dailyValueLabel,
      servingSize: parsed.servingSize || prev.servingSize,
      nutritionFootnote: parsed.footnote,
      nutritionIngredientsText: parsed.ingredientsText,
      nutritionContainsText: parsed.containsText,
      nutritionNoticeText: parsed.noticeText,
    }));
    setNutrients(parsed.nutrients);
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
        name: form.name,
        category: form.category,
        brandName: form.brandName,
        price: Number(form.price),
        discountPrice: form.discountPrice ? Number(form.discountPrice) : undefined,
        currency: form.currency,
        stock: Number(form.stock || "0"),
        isActive: form.isActive,
        image: imageUrl,
        hoverImage: hoverImageUrl || undefined,
        gallery: splitCommaSeparated(form.gallery),
        description: form.description,
        details: {
          overview: form.overview,
          ingredients: splitCommaSeparated(form.ingredients),
          benefits: splitCommaSeparated(form.benefits),
          howToUse: splitCommaSeparated(form.howToUse),
          warnings: splitCommaSeparated(form.warnings),
          additionalInfo: splitCommaSeparated(form.additionalInfo),
          servingInfo: {
            title: form.nutritionTitle,
            amountPerServingLabel: form.amountPerServingLabel,
            dailyValueLabel: form.dailyValueLabel,
            servingSize: form.servingSize || undefined,
            servingsPerContainer: form.servingsPerContainer ? Number(form.servingsPerContainer) : undefined,
            nutrients: nutrients
              .map((nutrient) => ({
                name: nutrient.name.trim(),
                amount: nutrient.amount.trim(),
                dailyValue: nutrient.dailyValue.trim(),
                indentLevel: nutrient.indentLevel,
                emphasized: nutrient.emphasized,
              }))
              .filter((nutrient) => nutrient.name),
            footnote: form.nutritionFootnote,
            ingredientsText: form.nutritionIngredientsText,
            containsText: form.nutritionContainsText,
            noticeText: form.nutritionNoticeText,
          }
        },
        coa: {
          certificateUrl: form.certificateUrl,
          verified: form.verified,
        }
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
    } catch {
      alert("Operation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <div className="relative w-full sm:w-72">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 outline-none transition-colors focus:border-[#01C7FE] focus:ring-1 focus:ring-[#01C7FE]"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSelectAllProducts}
            disabled={currentPageProductIds.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckSquare size={16} />
            {allVisibleSelected ? "Clear Selection" : "Select All"}
          </button>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#01C7FE] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#00b3e6]"
          >
            <Plus size={18} />
            Add Product
          </button>
        </div>
      </header>

      {/* Data Table */}
      <main className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500">
            {selectedProductIds.length > 0
              ? `${selectedProductIds.length} selected`
              : `${filteredProducts.length} product${filteredProducts.length === 1 ? "" : "s"} found`}
          </p>
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={selectedProductIds.length === 0 || deleteLoading}
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
                    onChange={handleSelectAllProducts}
                    disabled={currentPageProductIds.length === 0}
                    className="h-4 w-4 rounded border-gray-300 text-[#01C7FE] focus:ring-[#01C7FE]"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Image</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Category</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Brand</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Price</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Stock</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {paginatedProducts.map((product) => (
                <tr key={product._id} className="transition-colors hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedProductIds.includes(product._id)}
                      onChange={() => toggleProductSelection(product._id)}
                      className="h-4 w-4 rounded border-gray-300 text-[#01C7FE] focus:ring-[#01C7FE]"
                    />
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <img src={product.image || "/placeholder.png"} alt={product.name} className="h-10 w-10 rounded-md border border-gray-200 object-cover" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900">{product.name}</span>
                      <span className="text-xs text-gray-500">{product.slug}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{product.category}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{product.brandName || "-"}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{product.currency || "LKR"} {product.price.toLocaleString()}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{product.stock}</td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${product.isActive ? "bg-green-50 text-green-700 ring-green-600/20" : "bg-gray-50 text-gray-600 ring-gray-500/20"}`}>
                      {product.isActive ? "Active" : "Hidden"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => handleEdit(product)} className="text-gray-400 hover:text-[#01C7FE]"><Edit2 size={18} /></button>
                      <button onClick={() => handleDelete(product._id)} className="text-gray-400 hover:text-red-500"><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedProducts.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-sm text-gray-500">No products found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filteredProducts.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-gray-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)} of {filteredProducts.length}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"><ArrowLeft size={16} /> Previous</button>
              <span className="text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
              <button onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">Next <ArrowRight size={16} /></button>
            </div>
          </div>
        )}
      </main>

      {/* Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-sm sm:p-6">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900">{editingId ? "Edit Product" : "New Product"}</h3>
              <button onClick={closeModal} className="rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-900 p-1"><X size={20} /></button>
            </div>

            {/* Modal Body (Scrollable) */}
            <form id="product-form" onSubmit={handleSubmit} className="flex flex-col overflow-y-auto p-6 gap-8">
              
              {/* --- BASIC INFO --- */}
              <div className="flex flex-col gap-5">
                <h4 className="font-semibold text-gray-900 border-b pb-2">Basic Info</h4>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="text-sm font-medium text-gray-700">Product Name *</label>
                    <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className={inputClass} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Product Slug</label>
                    <input type="text" value={generatedProductSlug} readOnly className={`${inputClass} bg-gray-100 text-gray-500`} placeholder="Generated from product name" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Category *</label>
                    <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required className={inputClass}>
                      <option value="">Select category</option>
                      {categories.map((c) => (<option key={c._id} value={c.name}>{c.name}</option>))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Category Slug</label>
                    <input type="text" value={generatedCategorySlug} readOnly className={`${inputClass} bg-gray-100 text-gray-500`} placeholder="Generated from category" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Brand</label>
                    <select value={form.brandName} onChange={(e) => setForm({ ...form, brandName: e.target.value })} className={inputClass}>
                      <option value="">No brand</option>
                      {brands.map((b) => (<option key={b._id} value={b.name}>{b.name}</option>))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Brand Slug</label>
                    <input type="text" value={generatedBrandSlug} readOnly className={`${inputClass} bg-gray-100 text-gray-500`} placeholder="Generated from brand" />
                  </div>
                </div>
              </div>

              {/* --- PRICING & INVENTORY --- */}
              <div className="flex flex-col gap-5">
                <h4 className="font-semibold text-gray-900 border-b pb-2">Pricing & Inventory</h4>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Currency</label>
                    <input type="text" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className={inputClass} placeholder="LKR" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Price *</label>
                    <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required className={inputClass} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Discount Price</label>
                    <input type="number" value={form.discountPrice} onChange={(e) => setForm({ ...form, discountPrice: e.target.value })} className={inputClass} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Stock</label>
                    <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className={inputClass} />
                  </div>
                  <div className="flex flex-col gap-1.5 sm:col-span-4">
                    <label className="text-sm font-medium text-gray-700">Visibility Status</label>
                    <select value={form.isActive ? "active" : "hidden"} onChange={(e) => setForm({ ...form, isActive: e.target.value === "active" })} className={inputClass}>
                      <option value="active">Active (Visible)</option>
                      <option value="hidden">Hidden</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* --- IMAGES --- */}
              <div className="flex flex-col gap-5">
                <h4 className="font-semibold text-gray-900 border-b pb-2">Images</h4>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Main Image *</label>
                    <input type="file" ref={mainFileInputRef} onChange={handleMainImageChange} hidden accept="image/*" />
                    <div onClick={() => mainFileInputRef.current?.click()} className="group relative flex h-32 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:border-[#01C7FE] hover:bg-white">
                      {form.image ? <img src={form.image} alt="Main" className="h-full w-full object-cover" /> : <div className="flex flex-col items-center gap-1 text-gray-500 group-hover:text-[#01C7FE]"><Plus size={24} /><span className="text-xs font-medium">Upload Image</span></div>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Hover Image (Optional)</label>
                    <input type="file" ref={hoverFileInputRef} onChange={handleHoverImageChange} hidden accept="image/*" />
                    <div onClick={() => hoverFileInputRef.current?.click()} className="group relative flex h-32 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:border-[#01C7FE] hover:bg-white">
                      {form.hoverImage ? <img src={form.hoverImage} alt="Hover" className="h-full w-full object-cover" /> : <div className="flex flex-col items-center gap-1 text-gray-500 group-hover:text-[#01C7FE]"><Plus size={24} /><span className="text-xs font-medium">Upload Image</span></div>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="text-sm font-medium text-gray-700">Gallery URLs (Comma-separated)</label>
                    <textarea value={form.gallery} onChange={(e) => setForm({ ...form, gallery: e.target.value })} placeholder="https://image1.jpg, https://image2.jpg" className={`${inputClass} h-20 resize-none`} />
                  </div>
                </div>
              </div>

              {/* --- DETAILS & CONTENT --- */}
              <div className="flex flex-col gap-5">
                <h4 className="font-semibold text-gray-900 border-b pb-2">Product Details</h4>
                <div className="grid grid-cols-1 gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Short Description (Legacy)</label>
                    <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${inputClass} h-20`} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Overview</label>
                    <textarea value={form.overview} onChange={(e) => setForm({ ...form, overview: e.target.value })} className={`${inputClass} h-24`} />
                  </div>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-gray-700">Ingredients (Comma-separated)</label>
                      <textarea value={form.ingredients} onChange={(e) => setForm({ ...form, ingredients: e.target.value })} className={`${inputClass} h-20`} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-gray-700">Benefits (Comma-separated)</label>
                      <textarea value={form.benefits} onChange={(e) => setForm({ ...form, benefits: e.target.value })} className={`${inputClass} h-20`} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-gray-700">How to Use (Comma-separated steps)</label>
                      <textarea value={form.howToUse} onChange={(e) => setForm({ ...form, howToUse: e.target.value })} className={`${inputClass} h-20`} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-gray-700">Warnings (Comma-separated)</label>
                      <textarea value={form.warnings} onChange={(e) => setForm({ ...form, warnings: e.target.value })} className={`${inputClass} h-20`} />
                    </div>
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label className="text-sm font-medium text-gray-700">Additional Info (Comma-separated)</label>
                      <textarea value={form.additionalInfo} onChange={(e) => setForm({ ...form, additionalInfo: e.target.value })} className={`${inputClass} h-20`} />
                    </div>
                  </div>
                </div>
              </div>

              {/* --- SUPPLEMENT FACTS --- */}
              <div className="flex flex-col gap-5">
                <h4 className="font-semibold text-gray-900 border-b pb-2">Supplement Facts</h4>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Paste Nutrition Facts Text</label>
                  <textarea
                    value={form.nutritionFactsText}
                    onChange={(e) => setForm({ ...form, nutritionFactsText: e.target.value })}
                    placeholder={"Paste the label text exactly as you have it.\n\nNutrition Facts\nServing Size: 1 Scoop (32g)\nAmount Per Serving    % Daily Value\nCalories    120\nTotal Fat    1g    1%"}
                    className={`${inputClass} min-h-40`}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-gray-500">
                      Paste the nutrition block, then parse it into editable fields.
                    </p>
                    <button
                      type="button"
                      onClick={handleParseNutritionFacts}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      Parse Nutrition Text
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Title</label>
                    <input type="text" value={form.nutritionTitle} onChange={(e) => setForm({ ...form, nutritionTitle: e.target.value })} className={inputClass} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Serving Size</label>
                    <input type="text" value={form.servingSize} onChange={(e) => setForm({ ...form, servingSize: e.target.value })} placeholder="e.g. 1 scoop (30g)" className={inputClass} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Amount Per Serving Label</label>
                    <input type="text" value={form.amountPerServingLabel} onChange={(e) => setForm({ ...form, amountPerServingLabel: e.target.value })} className={inputClass} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Servings Per Container</label>
                    <input type="number" value={form.servingsPerContainer} onChange={(e) => setForm({ ...form, servingsPerContainer: e.target.value })} className={inputClass} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Daily Value Label</label>
                    <input type="text" value={form.dailyValueLabel} onChange={(e) => setForm({ ...form, dailyValueLabel: e.target.value })} className={inputClass} />
                  </div>
                </div>
                
                <div className="flex flex-col gap-3">
                  <label className="text-sm font-medium text-gray-700">Nutrition Rows</label>
                  {nutrients.map((nutrient, index) => (
                    <div key={index} className="grid grid-cols-1 gap-2 rounded-lg border border-gray-200 p-3 sm:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1fr)_120px_110px_44px] sm:items-center">
                      <input type="text" placeholder="Name (e.g. Protein)" value={nutrient.name} onChange={(e) => updateNutrient(index, "name", e.target.value)} className={inputClass} />
                      <input type="text" placeholder="Amount (e.g. 24g)" value={nutrient.amount} onChange={(e) => updateNutrient(index, "amount", e.target.value)} className={inputClass} />
                      <input type="text" placeholder="Daily % (e.g. 48%)" value={nutrient.dailyValue} onChange={(e) => updateNutrient(index, "dailyValue", e.target.value)} className={inputClass} />
                      <select value={String(nutrient.indentLevel)} onChange={(e) => updateNutrient(index, "indentLevel", Number(e.target.value))} className={inputClass}>
                        <option value="0">Main row</option>
                        <option value="1">Indented</option>
                      </select>
                      <label className="flex items-center gap-2 text-sm text-gray-600">
                        <input type="checkbox" checked={nutrient.emphasized} onChange={(e) => updateNutrient(index, "emphasized", e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#01C7FE] focus:ring-[#01C7FE]" />
                        Bold
                      </label>
                      <button type="button" onClick={() => removeNutrientField(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Minus size={18}/></button>
                    </div>
                  ))}
                  <button type="button" onClick={addNutrientField} className="text-sm text-[#01C7FE] font-medium flex items-center gap-1 hover:underline w-fit mt-1">
                    <Plus size={16}/> Add Nutrient
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Nutrition Footnote</label>
                    <textarea value={form.nutritionFootnote} onChange={(e) => setForm({ ...form, nutritionFootnote: e.target.value })} className={`${inputClass} h-20`} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Ingredients Text</label>
                    <textarea value={form.nutritionIngredientsText} onChange={(e) => setForm({ ...form, nutritionIngredientsText: e.target.value })} className={`${inputClass} h-24`} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Contains Text</label>
                    <textarea value={form.nutritionContainsText} onChange={(e) => setForm({ ...form, nutritionContainsText: e.target.value })} className={`${inputClass} h-20`} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Notice Text</label>
                    <textarea value={form.nutritionNoticeText} onChange={(e) => setForm({ ...form, nutritionNoticeText: e.target.value })} className={`${inputClass} h-20`} />
                  </div>
                </div>
              </div>

              {/* --- AUTHENTICITY (COA) --- */}
              <div className="flex flex-col gap-5">
                <h4 className="font-semibold text-gray-900 border-b pb-2">Authenticity & Verification</h4>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 items-center">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Certificate of Analysis URL</label>
                    <input type="text" value={form.certificateUrl} onChange={(e) => setForm({ ...form, certificateUrl: e.target.value })} placeholder="Link to PDF/Image" className={inputClass} />
                  </div>
                  <div className="flex items-center gap-2 mt-6">
                    <input type="checkbox" id="verified" checked={form.verified} onChange={(e) => setForm({ ...form, verified: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-[#01C7FE] focus:ring-[#01C7FE]" />
                    <label htmlFor="verified" className="text-sm font-medium text-gray-700">Mark as Verified ✅</label>
                  </div>
                </div>
              </div>

            </form>

            {/* Modal Footer Actions */}
            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
              <button type="button" onClick={closeModal} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50">
                Cancel
              </button>
              <button form="product-form" type="submit" disabled={loading} className="rounded-lg bg-[#01C7FE] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#00b3e6] disabled:cursor-not-allowed disabled:opacity-50">
                {loading ? "Processing..." : editingId ? "Update Product" : "Create Product"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
