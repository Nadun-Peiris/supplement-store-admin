import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth } from "@/lib/firebaseAdmin";

/* ---------------------------------------------------------
   Verify Firebase Token
   Returns DecodedIdToken OR throws error
--------------------------------------------------------- */
export const verifyToken = async (
  token: string
): Promise<DecodedIdToken> => {
  if (!token) {
    throw new Error("No token provided");
  }

  return adminAuth.verifyIdToken(token);
};

export const verifySessionToken = async (
  sessionCookie: string
): Promise<DecodedIdToken> => {
  if (!sessionCookie) {
    throw new Error("No session cookie provided");
  }

  return adminAuth.verifySessionCookie(sessionCookie, true);
};
