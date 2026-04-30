import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";

export const ADMIN_SESSION_COOKIE = "adminSession";

const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 5;

const baseCookieOptions = {
  httpOnly: true,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

export async function createAdminSessionCookie(idToken: string) {
  return adminAuth.createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_MS,
  });
}

export function setAdminSessionCookie(
  response: NextResponse,
  sessionCookie: string
) {
  response.cookies.set({
    ...baseCookieOptions,
    name: ADMIN_SESSION_COOKIE,
    value: sessionCookie,
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set({
    ...baseCookieOptions,
    name: ADMIN_SESSION_COOKIE,
    value: "",
    maxAge: 0,
  });
}
