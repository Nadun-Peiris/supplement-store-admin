export const runtime = "nodejs";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/utils/verifyToken";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";

const protectedRoutes = [
  "/dashboard",
  "/reports",
  "/products",
  "/admins",
  "/users",
  "/settings",
];

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const token = req.cookies.get("firebaseToken")?.value;

  if (url.pathname === "/" || url.pathname.startsWith("/login")) {
    return NextResponse.next();
  }

  if (protectedRoutes.some((path) => url.pathname.startsWith(path))) {
    if (!token) {
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    try {
      const decoded = await verifyToken(token);

      if (!decoded?.uid) {
        url.pathname = "/login";
        return NextResponse.redirect(url);
      }

      await connectDB();

      const user = await User.findOne({
        firebaseId: decoded.uid,
      }).lean();

      if (!user) {
        url.pathname = "/login";
        return NextResponse.redirect(url);
      }

      // 🔥 Blocked users cannot access
      if (user.isBlocked) {
        url.pathname = "/blocked";
        return NextResponse.redirect(url);
      }

      // 🔥 Only admin + superadmin allowed
      if (user.role !== "admin" && user.role !== "superadmin") {
        url.pathname = "/";
        return NextResponse.redirect(url);
      }

      // 🔥 Admins page is restricted to superadmin only
      if (
        url.pathname.startsWith("/dashboard/admins") &&
        user.role !== "superadmin"
      ) {
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }

      return NextResponse.next();
    } catch (err) {
      console.error("Token verification failed:", err);
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/reports/:path*",
    "/products/:path*",
    "/admins/:path*",
    "/users/:path*",
    "/settings/:path*",
  ],
};
