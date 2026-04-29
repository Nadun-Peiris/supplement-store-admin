"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import PageLoader from "@/app/(admin)/dashboard/components/PageLoader";
import {
  LayoutDashboard,
  ShoppingBag,
  CreditCard,
  Repeat,
  Package,
  Layers,
  Tag,
  ShieldCheck,
  Users,
  FileText,
  User as UserIcon,
  X,
  Menu,
  Search,
  AlertCircle,
} from "lucide-react";

type GlobalSearchResult = {
  id: string;
  type: "order" | "product" | "brand" | "category" | "user" | "admin" | "subscription";
  title: string;
  subtitle: string;
  href: string;
};

type SidebarBadgeKey = "orders" | "pendingPayments" | "subscriptions";
type SidebarOrder = {
  createdAt?: string;
  paymentStatus?: string;
  fulfillmentStatus?: string;
};
type SidebarSubscription = {
  createdAt?: string;
  adminViewed?: boolean;
};

const PENDING_PAYMENTS_VIEWED_AT_KEY = "admin-sidebar-pending-payments-viewed-at";

const navItems = [
  { name: "Overview", href: "/dashboard/overview", icon: LayoutDashboard },
  {
    name: "Orders",
    href: "/dashboard/orders",
    icon: ShoppingBag,
    badgeKey: "orders" as SidebarBadgeKey,
  },
  {
    name: "Pending Payments",
    href: "/dashboard/pending-payments",
    icon: CreditCard,
    badgeKey: "pendingPayments" as SidebarBadgeKey,
  },
  {
    name: "Subscriptions",
    href: "/dashboard/subscriptions",
    icon: Repeat,
    badgeKey: "subscriptions" as SidebarBadgeKey,
  },
  { name: "Products", href: "/dashboard/products", icon: Package },
  { name: "Categories", href: "/dashboard/categories", icon: Layers },
  { name: "Brands", href: "/dashboard/brands", icon: Tag },
  { name: "Admins", href: "/dashboard/admins", icon: ShieldCheck },
  { name: "Users", href: "/dashboard/users", icon: Users },
  { name: "Reports", href: "/dashboard/reports", icon: FileText },
  { name: "Profile", href: "/dashboard/profile", icon: UserIcon },
];

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchRef = useRef<HTMLDivElement | null>(null);
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [displayName, setDisplayName] = useState("Admin");
  const [role, setRole] = useState<"admin" | "superadmin" | null>(null);
  const [globalSearch, setGlobalSearch] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sidebarCounts, setSidebarCounts] = useState<Record<SidebarBadgeKey, number>>({
    orders: 0,
    pendingPayments: 0,
    subscriptions: 0,
  });

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setGlobalSearch("");
    setIsSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const query = globalSearch.trim();

    if (!isSearchOpen || query.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    let isCancelled = false;

    const timeoutId = window.setTimeout(async () => {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);

      try {
        const token = await currentUser.getIdToken();
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(query)}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error(`Search failed with status ${res.status}`);
        }

        const data = await res.json();

        if (!isCancelled) {
          setSearchResults(Array.isArray(data.results) ? data.results : []);
        }
      } catch (error) {
        console.error("Global search failed:", error);
        if (!isCancelled) {
          setSearchResults([]);
        }
      } finally {
        if (!isCancelled) {
          setIsSearching(false);
        }
      }
    }, 250);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [globalSearch, isSearchOpen]);

  // Auth & Role Loading
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setRole(null);
        setIsAuthLoading(false);
        router.replace("/login");
        return;
      }

      if (firebaseUser.displayName?.trim()) {
        setDisplayName(firebaseUser.displayName);
      } else if (firebaseUser.email) {
        setDisplayName(firebaseUser.email.split("@")[0]);
      }

      try {
        const token = await firebaseUser.getIdToken();
        document.cookie = `firebaseToken=${token}; path=/; max-age=3600; Secure; SameSite=Strict`;
        const res = await fetch("/api/auth/validate-role", {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          setRole(null);
          return;
        }

        const data = await res.json();
        if (data.role === "admin" || data.role === "superadmin") {
          setRole(data.role);
        } else {
          setRole(null);
        }
      } catch (error) {
        console.error("Failed to load user role:", error);
        setRole(null);
      } finally {
        setIsAuthLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (pathname === "/dashboard/pending-payments") {
      window.localStorage.setItem(PENDING_PAYMENTS_VIEWED_AT_KEY, new Date().toISOString());
    }
  }, [pathname]);

  useEffect(() => {
    if (!role) return;

    let isCancelled = false;

    const loadSidebarCounts = async () => {
      try {
        const [ordersRes, subscriptionsRes] = await Promise.all([
          fetch("/api/orders?type=all"),
          fetch("/api/subscriptions"),
        ]);

        if (!ordersRes.ok || !subscriptionsRes.ok) {
          throw new Error("Failed to load sidebar counts.");
        }

        const [ordersPayload, subscriptionsPayload] = await Promise.all([
          ordersRes.json(),
          subscriptionsRes.json(),
        ]);

        const orders: SidebarOrder[] = Array.isArray(ordersPayload.orders) ? ordersPayload.orders : [];
        const subscriptions: SidebarSubscription[] = Array.isArray(subscriptionsPayload.subscriptions)
          ? subscriptionsPayload.subscriptions
          : [];
        const pendingPaymentsViewedAt =
          typeof window === "undefined"
            ? ""
            : window.localStorage.getItem(PENDING_PAYMENTS_VIEWED_AT_KEY) || "";
        const firstPendingPaymentCreatedAtMs = orders
          .filter((order) => (order.paymentStatus || "pending").toLowerCase() === "pending")
          .reduce<number | null>((earliest, order) => {
            const createdAtMs = new Date(order.createdAt || 0).getTime();

            if (!Number.isFinite(createdAtMs) || createdAtMs <= 0) {
              return earliest;
            }

            if (earliest === null || createdAtMs < earliest) {
              return createdAtMs;
            }

            return earliest;
          }, null);

        if (
          typeof window !== "undefined" &&
          !pendingPaymentsViewedAt &&
          firstPendingPaymentCreatedAtMs !== null
        ) {
          const baseline = new Date(firstPendingPaymentCreatedAtMs).toISOString();
          window.localStorage.setItem(PENDING_PAYMENTS_VIEWED_AT_KEY, baseline);
        }

        const effectivePendingPaymentsViewedAt =
          pendingPaymentsViewedAt ||
          (firstPendingPaymentCreatedAtMs !== null
            ? new Date(firstPendingPaymentCreatedAtMs).toISOString()
            : "");
        const pendingPaymentsViewedAtMs = effectivePendingPaymentsViewedAt
          ? new Date(effectivePendingPaymentsViewedAt).getTime()
          : 0;

        if (!isCancelled) {
          setSidebarCounts({
            orders: orders.filter(
              (order) =>
                (order.fulfillmentStatus || "unfulfilled").toLowerCase() === "unfulfilled"
            ).length,
            pendingPayments: orders.filter((order) => {
              const createdAtMs = new Date(order.createdAt || 0).getTime();
              return (
                (order.paymentStatus || "pending").toLowerCase() === "pending" &&
                createdAtMs > pendingPaymentsViewedAtMs
              );
            }).length,
            subscriptions: subscriptions.filter((subscription) => !subscription.adminViewed).length,
          });
        }
      } catch (error) {
        console.error("Failed to load sidebar counts:", error);
      }
    };

    void loadSidebarCounts();

    return () => {
      isCancelled = true;
    };
  }, [pathname, role]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } finally {
      document.cookie = "firebaseToken=; path=/; max-age=0; Secure; SameSite=Strict";
      router.push("/login");
    }
  };

  const visibleNavItems = navItems.filter(
    (item) => item.href !== "/dashboard/admins" || role === "superadmin"
  );

  const roleLabel = useMemo(() => {
    if (role === "superadmin") return "Superadmin";
    if (role === "admin") return "Administrator";
    return "Administrator";
  }, [role]);

  const avatarLabel = useMemo(
    () => displayName.trim().charAt(0).toUpperCase() || "A",
    [displayName]
  );

  const handleGlobalSearchSelect = (href: string) => {
    setGlobalSearch("");
    setIsSearchOpen(false);
    setSearchResults([]);
    router.push(href);
  };

  const handleGlobalSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setIsSearchOpen(false);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (searchResults.length > 0) {
        handleGlobalSearchSelect(searchResults[0].href);
      }
    }
  };

  if (isAuthLoading) {
    return <PageLoader icon={LayoutDashboard} label="Loading Dashboard..." className="min-h-screen" />;
  }

  if (!role) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f2fbff] px-4">
        <div className="flex max-w-sm flex-col items-center rounded-[28px] border border-white bg-white/85 p-8 text-center shadow-[0_20px_50px_rgba(3,199,254,0.08)] backdrop-blur-xl">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
            <AlertCircle size={32} />
          </div>
          <h1 className="mb-2 text-xl font-black text-[#111]">Access Denied</h1>
          <p className="mb-6 text-xs font-bold text-[#888]">
            You do not have administrator privileges to view this area.
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-2xl bg-red-500 px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-[0_10px_25px_rgba(239,68,68,0.28)] transition hover:scale-[1.02] hover:bg-red-600"
          >
            Log Out
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f2fbff] font-sans">
      
      {/* --- MOBILE OVERLAY --- */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-[#111]/20 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* --- SIDEBAR --- */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[#cfeef7] bg-white transition-transform duration-300 ease-in-out lg:static lg:h-screen lg:shrink-0 lg:translate-x-0 ${
          isMobileMenuOpen ? "translate-x-0 shadow-2xl lg:shadow-none" : "-translate-x-full"
        }`}
      >
        {/* Sidebar Header (Strictly locked to h-20 for alignment) */}
        <div className="flex h-20 shrink-0 items-center justify-between border-b border-[#cfeef7] px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#03c7fe] text-white shadow-[0_4px_10px_rgba(3,199,254,0.3)]">
              <Layers size={16} strokeWidth={3} />
            </div>
            <h1 className="text-sm font-black uppercase tracking-widest text-[#111]">
              ADMIN PANEL
            </h1>
          </div>

          <button
            type="button"
            className="rounded-full p-2 text-[#aaa] transition-colors hover:bg-[#f2fbff] hover:text-[#111] lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-4 py-6 hide-scrollbar">
          <p className="mb-4 px-2 text-[10px] font-black uppercase tracking-widest text-[#aaa]">
            Main Menu
          </p>
          <nav className="flex flex-col gap-2">
            {visibleNavItems.map((item) => {
              const isActive =
                item.href === "/dashboard/overview"
                  ? pathname === "/dashboard" || pathname === item.href
                  : pathname === item.href || pathname?.startsWith(`${item.href}/`);
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-xs font-black transition-all ${
                    isActive
                      ? "bg-[#03c7fe] text-white shadow-[0_8px_20px_rgba(3,199,254,0.3)]"
                      : "text-[#888] hover:bg-[#f2fbff] hover:text-[#03c7fe]"
                  }`}
                >
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="min-w-0 flex-1">{item.name}</span>
                  {item.badgeKey && sidebarCounts[item.badgeKey] > 0 ? (
                    <span
                      className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[9px] font-black ${
                        isActive ? "bg-white text-red-500" : "bg-red-500 text-white"
                      }`}
                    >
                      {sidebarCounts[item.badgeKey]}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        
        {/* --- TOPBAR --- */}
        <header className="sticky top-0 z-30 flex w-full flex-col border-b border-[#cfeef7] bg-white/80 backdrop-blur-xl lg:h-20 lg:flex-row lg:items-center lg:justify-between px-4 py-4 lg:py-0 lg:px-8 gap-4">
          
          {/* Left: Mobile Menu Toggle & Search */}
          <div className="flex w-full flex-1 items-center gap-4 lg:max-w-md">
            <button
              type="button"
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#cfeef7] bg-white text-[#aaa] shadow-sm transition hover:border-[#03c7fe] hover:text-[#03c7fe] lg:hidden"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={20} />
            </button>

            <div ref={searchRef} className="relative flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <Search size={16} className="text-[#aaa]" />
              </div>
              <input
                type="text"
                placeholder="Search globally..."
                value={globalSearch}
                onChange={(event) => {
                  setGlobalSearch(event.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => setIsSearchOpen(true)}
                onKeyDown={handleGlobalSearchKeyDown}
                className="block w-full rounded-2xl border border-[#cfeef7] bg-[#fbfdff] py-3 pl-10 pr-4 text-xs font-bold text-[#111] outline-none transition focus:border-[#03c7fe] focus:ring-2 focus:ring-[#03c7fe]/20"
              />
              {isSearchOpen && (
                <div className="absolute left-0 right-0 top-[calc(100%+0.75rem)] z-40 overflow-hidden rounded-3xl border border-[#cfeef7] bg-white shadow-[0_24px_60px_rgba(17,17,17,0.12)]">
                  {isSearching ? (
                    <div className="px-4 py-5 text-xs font-bold text-[#888]">
                      Searching records...
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div className="max-h-80 overflow-y-auto p-2">
                      {searchResults.map((item) => {
                        return (
                          <button
                            key={`${item.type}-${item.id}`}
                            type="button"
                            onClick={() => handleGlobalSearchSelect(item.href)}
                            className="flex w-full items-center justify-between gap-4 rounded-2xl px-4 py-3 text-left text-[#111] transition hover:bg-[#f8fdff]"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-xs font-black">{item.title}</p>
                              <p className="truncate text-[10px] font-bold uppercase tracking-widest text-[#888]">
                                {item.subtitle}
                              </p>
                            </div>
                            <span className="shrink-0 rounded-full bg-[#f2fbff] px-3 py-1 text-[9px] font-black uppercase tracking-widest text-[#03c7fe]">
                              {item.type}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : globalSearch.trim().length < 2 ? (
                    <div className="px-4 py-5 text-xs font-bold text-[#888]">
                      Type at least 2 characters to search orders, products, brands, categories, users, admins, and subscriptions.
                    </div>
                  ) : (
                    <div className="px-4 py-5 text-xs font-bold text-[#888]">
                      No matching records found.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Profile Info */}
          <div className="flex items-center justify-end gap-5">
            <button
              type="button"
              onClick={handleLogout}
              className="hidden sm:block rounded-2xl bg-red-500 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-[0_10px_25px_rgba(239,68,68,0.28)] transition hover:scale-[1.02] hover:bg-red-600"
            >
              Log Out
            </button>

            <div className="flex items-center gap-4 sm:border-l border-[#cfeef7] sm:pl-5">
              <div className="flex flex-col text-right">
                <p className="text-xs font-black text-[#111]">{displayName}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#03c7fe]">{roleLabel}</p>
              </div>
              
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#03c7fe] text-sm font-black text-white shadow-[0_4px_10px_rgba(3,199,254,0.3)]">
                {avatarLabel}
              </div>
            </div>
          </div>
        </header>

        {/* --- PAGE CONTENT --- */}
        <main className="flex-1 min-h-0 overflow-y-auto">
          <div className="min-h-full">
            {children}
          </div>
        </main>
        
      </div>
    </div>
  );
}
