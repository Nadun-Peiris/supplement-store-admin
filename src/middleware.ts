export const runtime = "nodejs"; // ✅ Enables Firebase Admin in middleware

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyIdToken } from "@/utils/verifyToken";

// ✅ Define all protected admin routes
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

  // Allow free access to /login and site root
  if (url.pathname === "/" || url.pathname.startsWith("/login")) {
    return NextResponse.next();
  }

  // 🔐 Protect admin routes
  if (protectedRoutes.some((path) => url.pathname.startsWith(path))) {
    if (!token) {
      // No cookie → redirect to login
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    try {
      const decoded = await verifyIdToken(token);
      if (decoded) {
        return NextResponse.next(); // ✅ Authorized
      } else {
        url.pathname = "/login";
        return NextResponse.redirect(url);
      }
    } catch (err) {
      console.error("Token verification failed:", err);
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  // All other public routes
  return NextResponse.next();
}

// ✅ Apply to all admin-related routes
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
