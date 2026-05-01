"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { adminFetch } from "@/lib/adminClient";
import { uploadToCloudinary } from "@/lib/uploadToCloudinary";
import { ArrowLeft, ArrowRight, Edit2, Plus, Search, Trash2, X, Minus, Package } from "lucide-react";
import PageLoader from "@/app/(admin)/dashboard/components/PageLoader";

/* ─── Shared UI Component ────────────────────────────────────────── */
function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[28px] border border-white bg-white/80 backdrop-blur-xl shadow-[0_20px_50px_rgba(3,199,254,0.08)] ${className}`}>
      {children}
    </div>
  );
}

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

const inputClass = "w-full rounded-2xl border border-[#cfeef7] bg-white px-4 py-3 text-sm font-bold text-[#111] outline-none transition-colors focus:border-[#03c7fe] focus:ring-2 focus:ring-[#03c7fe]/20";
const formatPrice = (currency: string | undefined, amount: number) =>
  `${currency || "LKR"} ${amount.toLocaleString()}`;

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
  const [pageLoading, setPageLoading] = useState(true);

  const [mainImageFile, setMainImageFile] = useState<File | null>(null);
  const [hoverImageFile, setHoverImageFile] = useState<File | null>(null);

  const mainFileInputRef = useRef<HTMLInputElement>(null);
  const hoverFileInputRef = useRef<HTMLInputElement>(null);

  const fetchProducts = async () => {
    try {
      const res = await adminFetch("/api/products");
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
      const res = await adminFetch("/api/categories");
      const data = (await res.json()) as { categories?: Category[] };
      setCategories(data.categories || []);
    } catch (error) {
      console.error("Failed to fetch categories", error);
    }
  };

  const fetchBrands = async () => {
    try {
      const res = await adminFetch("/api/brands");
      const data = (await res.json()) as { brands?: Brand[] };
      setBrands(data.brands || []);
    } catch (error) {
      console.error("Failed to fetch brands", error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([fetchProducts(), fetchCategories(), fetchBrands()]);
      } finally {
        setPageLoading(false);
      }
    };

    void loadData();
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

  const inventorySummary = useMemo(() => {
    const totalProducts = products.length;
    const totalStockUnits = products.reduce(
      (sum, product) => sum + Math.max(0, Number(product.stock || 0)),
      0
    );
    const totalInventoryValue = products.reduce((sum, product) => {
      const basePrice = Number(product.price || 0);
      const effectivePrice =
        typeof product.discountPrice === "number" &&
        product.discountPrice > 0 &&
        product.discountPrice < basePrice
          ? product.discountPrice
          : basePrice;

      return sum + effectivePrice * Math.max(0, Number(product.stock || 0));
    }, 0);

    return {
      totalProducts,
      totalStockUnits,
      totalInventoryValue,
    };
  }, [products]);

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
        ids.map((id) => adminFetch(`/api/products/${id}`, { method: "DELETE" }))
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

      const res = await adminFetch(url, {
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

  if (pageLoading) {
    return <PageLoader icon={Package} label="Loading Products..." />;
  }

  return (
    <main className="min-h-screen bg-[#f2fbff] px-4 py-8 md:px-8">
      {/* Header Panel */}
      <Panel className="mb-6 flex flex-col gap-6 p-7 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#03c7fe] text-white shadow-[0_8px_20px_rgba(3,199,254,0.3)]">
            <Package size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Catalog Management</p>
            <h1 className="text-2xl font-black text-[#111]">Products</h1>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aaa]" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-[#cfeef7] bg-white py-3 pl-10 pr-4 text-xs font-bold text-[#111] outline-none transition focus:border-[#03c7fe] focus:ring-2 focus:ring-[#03c7fe]/20"
            />
          </div>
          <button
            onClick={openCreateModal}
            className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-[#03c7fe] px-5 py-3 text-xs font-black text-white shadow-[0_10px_25px_rgba(3,199,254,0.3)] transition hover:scale-[1.02]"
          >
            <Plus size={14} /> Add Product
          </button>
        </div>
      </Panel>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-[24px] border border-white bg-white/80 p-5 backdrop-blur-xl shadow-[0_20px_50px_rgba(3,199,254,0.08)]">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Total Products</p>
          <p className="mt-2 text-2xl font-black text-[#111]">
            {inventorySummary.totalProducts.toLocaleString()}
          </p>
        </div>
        <div className="rounded-[24px] border border-white bg-white/80 p-5 backdrop-blur-xl shadow-[0_20px_50px_rgba(3,199,254,0.08)]">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Total Stock</p>
          <p className="mt-2 text-2xl font-black text-[#111]">
            {inventorySummary.totalStockUnits.toLocaleString()}
          </p>
        </div>
        <div className="rounded-[24px] border border-white bg-white/80 p-5 backdrop-blur-xl shadow-[0_20px_50px_rgba(3,199,254,0.08)]">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Inventory Value</p>
          <p className="mt-2 text-2xl font-black text-[#111]">
            LKR {Math.round(inventorySummary.totalInventoryValue).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Table Panel */}
      <Panel className="p-6">
        <div className="mb-4 flex items-center justify-between border-b border-[#e0f4fb] pb-4">
          <div className="flex gap-4">
            <button
              onClick={handleSelectAllProducts}
              className="text-[10px] font-black uppercase text-[#03c7fe] hover:underline"
            >
              {allVisibleSelected ? "Clear Selection" : "Select Page"}
            </button>
            {selectedProductIds.length > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={deleteLoading}
                className="text-[10px] font-black uppercase text-red-500 hover:underline disabled:opacity-50"
              >
                {deleteLoading ? "Deleting..." : `Delete Selected (${selectedProductIds.length})`}
              </button>
            )}
          </div>
          <p className="text-[10px] font-black uppercase text-[#aaa]">{filteredProducts.length} total products</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Selection</th>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Image</th>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Name</th>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Category</th>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Brand</th>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Price</th>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Stock</th>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Status</th>
                <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProducts.map((product) => (
                <tr key={product._id} className="transition hover:bg-[#f2fbff] border-t border-[#e0f4fb]">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedProductIds.includes(product._id)}
                      onChange={() => toggleProductSelection(product._id)}
                      className="accent-[#03c7fe]"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <img src={product.image || "/placeholder.png"} alt={product.name} className="h-10 w-10 rounded-lg border border-[#cfeef7] object-cover" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-[#111]">{product.name}</span>
                      <span className="text-xs font-bold text-[#aaa]">/{product.slug}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-[#888]">{product.category}</td>
                  <td className="px-6 py-4 text-xs font-bold text-[#888]">{product.brandName || "-"}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span
                        className={`text-sm font-black ${
                          typeof product.discountPrice === "number" &&
                          product.discountPrice < product.price
                            ? "text-[#aaa] line-through"
                            : "text-[#111]"
                        }`}
                      >
                        {formatPrice(product.currency, product.price)}
                      </span>
                      {typeof product.discountPrice === "number" &&
                        product.discountPrice < product.price && (
                          <span className="text-sm font-black text-emerald-500">
                            {formatPrice(product.currency, product.discountPrice)}
                          </span>
                        )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-black text-[#111]">{product.stock}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ring-1 ring-inset ${product.isActive ? "bg-emerald-50 text-emerald-600 ring-emerald-500/20" : "bg-gray-50 text-[#aaa] ring-gray-200"}`}>
                      {product.isActive ? "Active" : "Hidden"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => handleEdit(product)} className="text-[#aaa] hover:text-[#03c7fe]"><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(product._id)} className="text-[#aaa] hover:text-red-500"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedProducts.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-sm font-bold text-[#aaa]">No products found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredProducts.length > 0 && (
          <div className="mt-6 flex items-center justify-between border-t border-[#e0f4fb] pt-4">
            <p className="text-[10px] font-black text-[#aaa]">Page {currentPage} of {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(p-1, 1))} disabled={currentPage === 1} className="p-2 bg-[#f2fbff] rounded-full disabled:opacity-50 hover:bg-[#e0f4fb] transition"><ArrowLeft size={16} className="text-[#03c7fe]" /></button>
              <button onClick={() => setCurrentPage(p => Math.min(p+1, totalPages))} disabled={currentPage === totalPages} className="p-2 bg-[#f2fbff] rounded-full disabled:opacity-50 hover:bg-[#e0f4fb] transition"><ArrowRight size={16} className="text-[#03c7fe]" /></button>
            </div>
          </div>
        )}
      </Panel>

      {/* Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111]/20 p-4 backdrop-blur-sm sm:p-6">
          <Panel className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden p-0">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#cfeef7] bg-[#fbfdff] px-6 py-5">
              <h3 className="text-lg font-black text-[#111]">{editingId ? "Edit Product" : "New Product"}</h3>
              <button onClick={closeModal} className="rounded-full p-2 text-[#aaa] transition-colors hover:bg-[#f2fbff] hover:text-[#111]"><X size={20} /></button>
            </div>

            {/* Modal Body (Scrollable) */}
            <form id="product-form" onSubmit={handleSubmit} className="flex flex-col overflow-y-auto p-6 gap-8 bg-white">
              
              {/* --- BASIC INFO --- */}
              <div className="flex flex-col gap-5">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#03c7fe] border-b border-[#e0f4fb] pb-2">Basic Info</h4>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Product Name *</label>
                    <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className={inputClass} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Product Slug</label>
                    <input type="text" value={generatedProductSlug} readOnly className={`${inputClass} bg-[#fbfdff] text-[#aaa] border-dashed`} placeholder="Generated from product name" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Category *</label>
                    <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required className={inputClass}>
                      <option value="">Select category</option>
                      {categories.map((c) => (<option key={c._id} value={c.name}>{c.name}</option>))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Category Slug</label>
                    <input type="text" value={generatedCategorySlug} readOnly className={`${inputClass} bg-[#fbfdff] text-[#aaa] border-dashed`} placeholder="Generated from category" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Brand</label>
                    <select value={form.brandName} onChange={(e) => setForm({ ...form, brandName: e.target.value })} className={inputClass}>
                      <option value="">No brand</option>
                      {brands.map((b) => (<option key={b._id} value={b.name}>{b.name}</option>))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Brand Slug</label>
                    <input type="text" value={generatedBrandSlug} readOnly className={`${inputClass} bg-[#fbfdff] text-[#aaa] border-dashed`} placeholder="Generated from brand" />
                  </div>
                </div>
              </div>

              {/* --- PRICING & INVENTORY --- */}
              <div className="flex flex-col gap-5">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#03c7fe] border-b border-[#e0f4fb] pb-2">Pricing & Inventory</h4>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Currency</label>
                    <input type="text" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className={inputClass} placeholder="LKR" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Price *</label>
                    <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required className={inputClass} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Discount Price</label>
                    <input type="number" value={form.discountPrice} onChange={(e) => setForm({ ...form, discountPrice: e.target.value })} className={inputClass} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Stock</label>
                    <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className={inputClass} />
                  </div>
                  <div className="flex flex-col gap-2 sm:col-span-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Visibility Status</label>
                    <select value={form.isActive ? "active" : "hidden"} onChange={(e) => setForm({ ...form, isActive: e.target.value === "active" })} className={inputClass}>
                      <option value="active">Active (Visible)</option>
                      <option value="hidden">Hidden</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* --- IMAGES --- */}
              <div className="flex flex-col gap-5">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#03c7fe] border-b border-[#e0f4fb] pb-2">Images</h4>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Main Image *</label>
                    <input type="file" ref={mainFileInputRef} onChange={handleMainImageChange} hidden accept="image/*" />
                    <div onClick={() => mainFileInputRef.current?.click()} className="group relative flex h-40 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-[#cfeef7] bg-[#fbfdff] transition hover:border-[#03c7fe]">
                      {form.image ? <img src={form.image} alt="Main" className="h-full w-full object-cover" /> : <div className="flex flex-col items-center gap-1 text-[#aaa] group-hover:text-[#03c7fe]"><Plus size={24} /><span className="text-xs font-bold">Upload Image</span></div>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Hover Image (Optional)</label>
                    <input type="file" ref={hoverFileInputRef} onChange={handleHoverImageChange} hidden accept="image/*" />
                    <div onClick={() => hoverFileInputRef.current?.click()} className="group relative flex h-40 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-[#cfeef7] bg-[#fbfdff] transition hover:border-[#03c7fe]">
                      {form.hoverImage ? <img src={form.hoverImage} alt="Hover" className="h-full w-full object-cover" /> : <div className="flex flex-col items-center gap-1 text-[#aaa] group-hover:text-[#03c7fe]"><Plus size={24} /><span className="text-xs font-bold">Upload Image</span></div>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Gallery URLs (Comma-separated)</label>
                    <textarea value={form.gallery} onChange={(e) => setForm({ ...form, gallery: e.target.value })} placeholder="https://image1.jpg, https://image2.jpg" className={`${inputClass} h-24 resize-none`} />
                  </div>
                </div>
              </div>

              {/* --- DETAILS & CONTENT --- */}
              <div className="flex flex-col gap-5">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#03c7fe] border-b border-[#e0f4fb] pb-2">Product Details</h4>
                <div className="grid grid-cols-1 gap-5">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Short Description (Legacy)</label>
                    <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${inputClass} h-24 resize-none`} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Overview</label>
                    <textarea value={form.overview} onChange={(e) => setForm({ ...form, overview: e.target.value })} className={`${inputClass} h-24 resize-none`} />
                  </div>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Ingredients (Comma-separated)</label>
                      <textarea value={form.ingredients} onChange={(e) => setForm({ ...form, ingredients: e.target.value })} className={`${inputClass} h-24 resize-none`} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Benefits (Comma-separated)</label>
                      <textarea value={form.benefits} onChange={(e) => setForm({ ...form, benefits: e.target.value })} className={`${inputClass} h-24 resize-none`} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">How to Use (Comma-separated steps)</label>
                      <textarea value={form.howToUse} onChange={(e) => setForm({ ...form, howToUse: e.target.value })} className={`${inputClass} h-24 resize-none`} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Warnings (Comma-separated)</label>
                      <textarea value={form.warnings} onChange={(e) => setForm({ ...form, warnings: e.target.value })} className={`${inputClass} h-24 resize-none`} />
                    </div>
                    <div className="flex flex-col gap-2 sm:col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Additional Info (Comma-separated)</label>
                      <textarea value={form.additionalInfo} onChange={(e) => setForm({ ...form, additionalInfo: e.target.value })} className={`${inputClass} h-24 resize-none`} />
                    </div>
                  </div>
                </div>
              </div>

              {/* --- SUPPLEMENT FACTS --- */}
              <div className="flex flex-col gap-5">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#03c7fe] border-b border-[#e0f4fb] pb-2">Supplement Facts</h4>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Paste Nutrition Facts Text</label>
                  <textarea
                    value={form.nutritionFactsText}
                    onChange={(e) => setForm({ ...form, nutritionFactsText: e.target.value })}
                    placeholder={"Paste the label text exactly as you have it.\n\nNutrition Facts\nServing Size: 1 Scoop (32g)\nAmount Per Serving    % Daily Value\nCalories    120\nTotal Fat    1g    1%"}
                    className={`${inputClass} min-h-40 resize-y`}
                  />
                  <div className="flex items-center justify-between gap-3 mt-1">
                    <p className="text-[10px] font-bold text-[#aaa]">
                      Paste the nutrition block, then parse it into editable fields.
                    </p>
                    <button
                      type="button"
                      onClick={handleParseNutritionFacts}
                      className="rounded-2xl border border-[#cfeef7] px-4 py-2 text-xs font-black text-[#111] transition hover:bg-[#f2fbff]"
                    >
                      Parse Nutrition Text
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Title</label>
                    <input type="text" value={form.nutritionTitle} onChange={(e) => setForm({ ...form, nutritionTitle: e.target.value })} className={inputClass} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Serving Size</label>
                    <input type="text" value={form.servingSize} onChange={(e) => setForm({ ...form, servingSize: e.target.value })} placeholder="e.g. 1 scoop (30g)" className={inputClass} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Amount Per Serving Label</label>
                    <input type="text" value={form.amountPerServingLabel} onChange={(e) => setForm({ ...form, amountPerServingLabel: e.target.value })} className={inputClass} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Servings Per Container</label>
                    <input type="number" value={form.servingsPerContainer} onChange={(e) => setForm({ ...form, servingsPerContainer: e.target.value })} className={inputClass} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Daily Value Label</label>
                    <input type="text" value={form.dailyValueLabel} onChange={(e) => setForm({ ...form, dailyValueLabel: e.target.value })} className={inputClass} />
                  </div>
                </div>
                
                <div className="flex flex-col gap-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Nutrition Rows</label>
                  {nutrients.map((nutrient, index) => (
                    <div key={index} className="grid grid-cols-1 gap-3 rounded-2xl border border-[#cfeef7] bg-[#fbfdff] p-4 sm:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1fr)_120px_90px_44px] sm:items-center">
                      <input type="text" placeholder="Name" value={nutrient.name} onChange={(e) => updateNutrient(index, "name", e.target.value)} className={inputClass} />
                      <input type="text" placeholder="Amount" value={nutrient.amount} onChange={(e) => updateNutrient(index, "amount", e.target.value)} className={inputClass} />
                      <input type="text" placeholder="Daily %" value={nutrient.dailyValue} onChange={(e) => updateNutrient(index, "dailyValue", e.target.value)} className={inputClass} />
                      <select value={String(nutrient.indentLevel)} onChange={(e) => updateNutrient(index, "indentLevel", Number(e.target.value))} className={inputClass}>
                        <option value="0">Main row</option>
                        <option value="1">Indented</option>
                      </select>
                      <label className="flex items-center gap-2 text-xs font-bold text-[#555] cursor-pointer">
                        <input type="checkbox" checked={nutrient.emphasized} onChange={(e) => updateNutrient(index, "emphasized", e.target.checked)} className="h-4 w-4 rounded border-[#cfeef7] accent-[#03c7fe]" />
                        Bold
                      </label>
                      <button type="button" onClick={() => removeNutrientField(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors flex justify-center"><Minus size={18}/></button>
                    </div>
                  ))}
                  <button type="button" onClick={addNutrientField} className="text-xs text-[#03c7fe] font-black uppercase tracking-wider flex items-center gap-1 hover:underline w-fit mt-2">
                    <Plus size={16}/> Add Nutrient
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-5">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Nutrition Footnote</label>
                    <textarea value={form.nutritionFootnote} onChange={(e) => setForm({ ...form, nutritionFootnote: e.target.value })} className={`${inputClass} h-24 resize-none`} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Ingredients Text</label>
                    <textarea value={form.nutritionIngredientsText} onChange={(e) => setForm({ ...form, nutritionIngredientsText: e.target.value })} className={`${inputClass} h-24 resize-none`} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Contains Text</label>
                    <textarea value={form.nutritionContainsText} onChange={(e) => setForm({ ...form, nutritionContainsText: e.target.value })} className={`${inputClass} h-24 resize-none`} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Notice Text</label>
                    <textarea value={form.nutritionNoticeText} onChange={(e) => setForm({ ...form, nutritionNoticeText: e.target.value })} className={`${inputClass} h-24 resize-none`} />
                  </div>
                </div>
              </div>

              {/* --- AUTHENTICITY (COA) --- */}
              <div className="flex flex-col gap-5">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#03c7fe] border-b border-[#e0f4fb] pb-2">Authenticity & Verification</h4>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 items-center">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#888]">Certificate of Analysis URL</label>
                    <input type="text" value={form.certificateUrl} onChange={(e) => setForm({ ...form, certificateUrl: e.target.value })} placeholder="Link to PDF/Image" className={inputClass} />
                  </div>
                  <div className="flex items-center gap-2 mt-6">
                    <input type="checkbox" id="verified" checked={form.verified} onChange={(e) => setForm({ ...form, verified: e.target.checked })} className="h-4 w-4 rounded border-[#cfeef7] accent-[#03c7fe]" />
                    <label htmlFor="verified" className="text-xs font-black text-[#111] cursor-pointer">Mark as Verified ✅</label>
                  </div>
                </div>
              </div>

            </form>

            {/* Modal Footer Actions */}
            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[#cfeef7] bg-[#fbfdff] px-6 py-5">
              <button type="button" onClick={closeModal} className="rounded-2xl border border-[#cfeef7] bg-white px-5 py-3 text-xs font-black text-[#111] transition hover:bg-[#f2fbff]">
                Cancel
              </button>
              <button form="product-form" type="submit" disabled={loading} className="rounded-2xl bg-[#03c7fe] px-5 py-3 text-xs font-black text-white shadow-[0_10px_25px_rgba(3,199,254,0.3)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50">
                {loading ? "Processing..." : editingId ? "Update Product" : "Create Product"}
              </button>
            </div>
          </Panel>
        </div>
      )}
    </main>
  );
}
