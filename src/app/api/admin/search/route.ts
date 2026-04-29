import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import Order from "@/models/Order";
import Product from "@/models/Product";
import Brand from "@/models/Brand";
import Category from "@/models/Category";
import Subscription from "@/models/Subscription";
import User from "@/models/User";
import { verifyToken } from "@/utils/verifyToken";

type SearchResult = {
  id: string;
  type:
    | "order"
    | "product"
    | "brand"
    | "category"
    | "user"
    | "admin"
    | "subscription";
  title: string;
  subtitle: string;
  href: string;
};

type SearchOrder = {
  _id: { toString(): string } | string;
  billingDetails: {
    firstName: string;
    lastName: string;
    phone: string;
  };
};

type SearchProduct = {
  _id: { toString(): string } | string;
  name: string;
  category?: string;
  brandName?: string;
};

type SearchBrand = {
  _id: { toString(): string } | string;
  name: string;
};

type SearchCategory = {
  _id: { toString(): string } | string;
  name: string;
};

type SearchUser = {
  _id: { toString(): string } | string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
};

type SearchSubscription = {
  _id: { toString(): string } | string;
  subscriptionId: string;
  status?: string;
  orderId?: {
    billingDetails?: {
      email?: string;
    };
  } | null;
};

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function GET(req: Request) {
  try {
    await connectDB();

    const token = req.headers.get("authorization")?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let decoded;
    try {
      decoded = await verifyToken(token);
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUser = await User.findOne({ firebaseId: decoded.uid }).lean();

    if (!currentUser || currentUser.role === "customer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const rawQuery = searchParams.get("q")?.trim() || "";

    if (rawQuery.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const query = new RegExp(escapeRegex(rawQuery), "i");
    const isSuperadmin = currentUser.role === "superadmin";
    const isObjectIdQuery = /^[a-f\d]{24}$/i.test(rawQuery);
    const orderConditions = [
      ...(isObjectIdQuery ? [{ _id: rawQuery }] : []),
      { "billingDetails.firstName": query },
      { "billingDetails.lastName": query },
      { "billingDetails.email": query },
      { "billingDetails.phone": query },
      { trackingNumber: query },
      { "items.name": query },
    ];

    const [
      orders,
      products,
      brands,
      categories,
      users,
      subscriptions,
      admins,
    ] = await Promise.all([
      Order.find({
        $or: orderConditions,
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      Product.find({
        $or: [
          { name: query },
          { slug: query },
          { category: query },
          { brandName: query },
        ],
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      Brand.find({
        $or: [{ name: query }, { slug: query }],
      })
        .sort({ name: 1 })
        .limit(5)
        .lean(),
      Category.find({
        $or: [{ name: query }, { slug: query }],
      })
        .sort({ name: 1 })
        .limit(5)
        .lean(),
      User.find({
        $or: [
          { fullName: query },
          { email: query },
          { phone: query },
        ],
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      Subscription.find({
        $or: [
          { subscriptionId: query },
          { status: query },
          { "items.name": query },
        ],
      })
        .populate({
          path: "orderId",
          select: "billingDetails",
        })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      isSuperadmin
        ? User.find({
            role: { $in: ["admin", "superadmin"] },
            $or: [{ email: query }, { fullName: query }],
          })
            .sort({ email: 1 })
            .limit(5)
            .lean()
        : Promise.resolve([]),
    ]);

    const results: SearchResult[] = [
      ...(orders as SearchOrder[]).map((order) => ({
        id: order._id.toString(),
        type: "order" as const,
        title: `Order #${order._id.toString().slice(-6).toUpperCase()}`,
        subtitle: `${order.billingDetails.firstName} ${order.billingDetails.lastName} • ${order.billingDetails.phone}`,
        href: "/dashboard/orders",
      })),
      ...(products as SearchProduct[]).map((product) => ({
        id: product._id.toString(),
        type: "product" as const,
        title: product.name,
        subtitle: [product.category, product.brandName].filter(Boolean).join(" • "),
        href: "/dashboard/products",
      })),
      ...(brands as SearchBrand[]).map((brand) => ({
        id: brand._id.toString(),
        type: "brand" as const,
        title: brand.name,
        subtitle: "Brand",
        href: "/dashboard/brands",
      })),
      ...(categories as SearchCategory[]).map((category) => ({
        id: category._id.toString(),
        type: "category" as const,
        title: category.name,
        subtitle: "Category",
        href: "/dashboard/categories",
      })),
      ...(users as SearchUser[])
        .filter((user) => !["admin", "superadmin"].includes(user.role))
        .map((user) => ({
          id: user._id.toString(),
          type: "user" as const,
          title: user.fullName,
          subtitle: `${user.email} • ${user.phone}`,
          href: "/dashboard/users",
        })),
      ...(subscriptions as SearchSubscription[]).map((subscription) => ({
        id: subscription._id.toString(),
        type: "subscription" as const,
        title: subscription.subscriptionId,
        subtitle:
          subscription.orderId?.billingDetails?.email ||
          subscription.status ||
          "Subscription",
        href: "/dashboard/subscriptions",
      })),
      ...(admins as SearchUser[]).map((adminUser) => ({
        id: adminUser._id.toString(),
        type: "admin" as const,
        title: adminUser.fullName || adminUser.email,
        subtitle: `${adminUser.email} • ${adminUser.role}`,
        href: "/dashboard/admins",
      })),
    ];

    return NextResponse.json({ results: results.slice(0, 24) });
  } catch (error) {
    console.error("ADMIN SEARCH ERROR:", error);
    return NextResponse.json(
      { error: "Failed to search admin records" },
      { status: 500 }
    );
  }
}
