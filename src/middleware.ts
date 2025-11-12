export const runtime = "nodejs"; // ✅ Required for Firebase Admin in middleware

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/utils/verifyToken"; // ✅ fixed import name

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

  // Allow public access to home and login
  if (url.pathname === "/" || url.pathname.startsWith("/login")) {
    return NextResponse.next();
  }

  // 🔒 Protect admin routes
  if (protectedRoutes.some((path) => url.pathname.startsWith(path))) {
    if (!token) {
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    try {
      const decoded = await verifyToken(token);
      if (decoded && decoded.email) {
        // ✅ Authorized user
        return NextResponse.next();
      } else {
        url.pathname = "/login";
        return NextResponse.redirect(url);
      }
    } catch (err) {
      console.error("❌ Token verification failed:", err);
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  // ✅ All other routes proceed normally
  return NextResponse.next();
}

// ✅ Only apply to admin-related routes
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
