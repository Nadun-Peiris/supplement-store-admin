import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const token = req.cookies.get("firebaseToken")?.value;

  // 🔒 If trying to access /dashboard or its children without token → redirect to login
  if (req.nextUrl.pathname.startsWith("/dashboard") && !token) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  // ✅ Allow everything else
  return NextResponse.next();
}

// Apply only to these routes
export const config = {
  matcher: ["/dashboard/:path*"],
};
