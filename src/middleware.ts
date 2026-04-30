export const runtime = "nodejs";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, clearAdminSessionCookie } from "@/lib/server/adminSession";
import { verifyAdminSession } from "@/lib/server/verifyAdmin";

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const sessionCookie = req.cookies.get(ADMIN_SESSION_COOKIE)?.value || "";

  if (url.pathname === "/" || url.pathname.startsWith("/login")) {
    return NextResponse.next();
  }

  if (!url.pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  const requiredSuperadmin = url.pathname.startsWith("/dashboard/admins");
  const user = await verifyAdminSession(sessionCookie, {
    requireSuperadmin: requiredSuperadmin,
  });

  if (!user) {
    url.pathname = "/login";
    const response = NextResponse.redirect(url);
    clearAdminSessionCookie(response);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
